import { serve, ServerRequest, HmacSha256 } from "./deps.ts";
import { ShopifyOrderWebhook } from "./shopify.dto.ts";
import { UnifaunShipment, ShippingService } from "./unifaun.dto.ts";
import { hmac as hh } from "https://denopkg.com/chiefbiiko/hmac@v1.0.2/mod.ts";

const server = serve({ port: 8000 });
console.log("http://localhost:8000/");

const log = (description: string, logValue: boolean = true) =>
  <T extends any>(input: T) => {
    console.log(description);
    if (logValue) console.log(input);
    return input;
  };

const verifyRequestAndGetBody = (secret: string) =>
  async (req: ServerRequest): Promise<string> => {
    const buf: Uint8Array = await Deno.readAll(req.body);
    const hmac = new HmacSha256(secret).update(buf.buffer);
    // const hmacBase64 = btoa(hmac.hex());
    const hmacHeader = req.headers.get("X-Shopify-Hmac-SHA256");
    const hmacBase64 = btoa(hmac.digest().map(v => String.fromCharCode(v)).join(''));

    if (hmacBase64 !== hmacHeader) {
      throw new Error("Could not verify webhook came from Shopify");
    }

    const body = new TextDecoder().decode(buf);
    return body;
  };

const getShopifyDto = async (
  body: string,
): Promise<ShopifyOrderWebhook> => {
  return JSON.parse(body);
};

type GetShippingService = (order: ShopifyOrderWebhook) => ShippingService;
const getShippingServiceFixed = (serviceId: string): GetShippingService =>
  (order) => {
    return {
      id: serviceId,
    };
  };

const getOrderToShipmentTranslator = (
  senderId: string,
  getShippingService: GetShippingService,
) =>
  (order: ShopifyOrderWebhook): UnifaunShipment => ({
    sender: {
      quickId: senderId,
    },
    goodsDescription: "Baby clothes",
    orderNo: order.name,
    receiver: {
      name: order.shipping_address.name,
      address1: order.shipping_address.address1,
      address2: order.shipping_address.address2,
      zipcode: order.shipping_address.zip,
      city: order.shipping_address.city,
      country: order.shipping_address.country_code,
    },
    service: getShippingService(order),
    parcels: [{
      contents: "Baby clothes",
      copies: 1,
      valuePerParcel: true,
      weight: order.total_weight,
    }],
    senderReference: order.email,
    test: order.test,
  });

const getShipmentCreator = (unifaunToken: string) => {
  return async (shipment: UnifaunShipment) => {
    const response = await fetch(
      "https://api.unifaun.com/rs-extapi/v1/stored-shipments",
      {
        method: "post",
        body: JSON.stringify(shipment),
        headers: {
          Authorization: `Bearer ${unifaunToken}`,
          "Content-Type": "application/json",
        },
      },
    );
    if (!response.ok) {
      throw new Error(`Could not create shipment ${response.statusText}`);
    }
    return response.json();
  };
};

const unifaunToken = Deno.env.get("UNIFAUN_TOKEN");
const unifaunSender = Deno.env.get("UNIFAUN_SENDER");
const unifaunService = Deno.env.get("UNIFAUN_SERVICE");
const shopifyWebhookSecret = Deno.env.get("SHOPIFY_WEBHOOK_SECRET");

if (
  !unifaunToken || !unifaunSender || !unifaunService || !shopifyWebhookSecret
) {
  throw new Error("Needed environment variables not set");
}

const createShipment = getShipmentCreator(unifaunToken);
const toShipment = getOrderToShipmentTranslator(
  unifaunSender,
  getShippingServiceFixed(unifaunService),
);
const verifyAndGetBody = verifyRequestAndGetBody(shopifyWebhookSecret);

for await (const req of server) {
  await Promise
    .resolve(req)
    .then(verifyAndGetBody)
    .then(getShopifyDto)
    .then(log("Got data from Shopify:"))
    .then(toShipment)
    .then(createShipment)
    .then(log("Created shipment:"));

  req.respond({ body: "Ok" });
}

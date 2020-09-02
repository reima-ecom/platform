type Parcel = {
  copies: number;
  weight: number;
  contents: string;
  valuePerParcel: boolean;
};

type PrintSet = string[];
type DateString = string;

type ShippingServiceId = string;
export type ShippingService = {
  id: ShippingServiceId
};

type CustomsDeclarationLine = {
  contents: string;
  statNo: string;
  subStatNo1: string | null;
  sourceCountryCode: string;
  copies: number;
  value: number;
  netWeight: number;
  valuesPerItem: boolean;
};

type CustomsDeclaration = {
  invoiceType: string;
  invoiceNo: string;
  termCode: string;
  currencyCode: string;
  declarant: string;
  jobTitle: string;
  declarantCity: string;
  declarantDate: DateString;
  printSet: PrintSet;
  lines: CustomsDeclarationLine[];
};

export type UnifaunShipment = {
  sender: {
    quickId: string;
  };
  receiver: {
    name: string;
    contact?: string;
    address1: string;
    address2?: string;
    zipcode: string;
    city: string;
    country: string;
    phone?: string;
    mobile?: string;
    email?: string;
  };
  service: ShippingService;
  orderNo: string;
  senderReference: string;
  goodsDescription: string;
  parcels: Parcel[];
  customsDeclaration?: CustomsDeclaration;
  test?: boolean;
};

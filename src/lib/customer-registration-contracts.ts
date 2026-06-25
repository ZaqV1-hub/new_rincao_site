import type {
  CustomerProfileCityOption,
  CustomerProfileUfOption,
} from "@/lib/customer-profile-contracts";

export type CustomerRegistrationLocationsResponse = {
  ok: true;
  data: {
    ufs: CustomerProfileUfOption[];
    cities: CustomerProfileCityOption[];
    selectedUf: string | null;
  };
};

export type CustomerRegistrationCepResponse = {
  ok: true;
  data: {
    cep: string;
    address: string;
    district: string;
    uf: CustomerProfileUfOption;
    city: CustomerProfileCityOption;
    complement: string | null;
  };
};

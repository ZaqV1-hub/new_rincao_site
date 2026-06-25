import type { AuthUser } from "@/lib/auth-contracts";

export type CustomerProfile = AuthUser & {
  cpf: string;
  status: string | null;
  rg: string | null;
  birthDate: string | null;
  sex: "m" | "f" | null;
  phone: string | null;
  mobile: string | null;
  address: string | null;
  number: string | null;
  cep: string | null;
  district: string | null;
  uf: string | null;
  cityId: number | null;
  cityName: string | null;
  complement: string | null;
};

export type CustomerProfileUfOption = {
  id: string;
  name: string;
};

export type CustomerProfileCityOption = {
  id: number;
  name: string;
};

export type CustomerProfileResponse = {
  ok: true;
  data: {
    profile: CustomerProfile;
    locations: {
      ufs: CustomerProfileUfOption[];
      cities: CustomerProfileCityOption[];
    };
  };
};

export type CustomerProfileCitiesResponse = {
  ok: true;
  data: {
    uf: string;
    cities: CustomerProfileCityOption[];
  };
};

export type CustomerProfilePasswordResponse = {
  ok: true;
  data: {
    updated: true;
  };
};

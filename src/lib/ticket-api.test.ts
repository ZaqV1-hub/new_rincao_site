import { afterEach, describe, expect, it } from "vitest";
import { defaultTicketsApiBaseUrl, getTicketsApiBaseUrl } from "@/lib/ticket-api";

const originalEnv = process.env;

describe("ticket-api", () => {
  afterEach(() => {
    process.env = originalEnv;
  });

  it("uses the website ticket api url when it is configured", () => {
    process.env = {
      ...originalEnv,
      TICKETS_API_BASE_URL: "https://website-ticket.example.test///",
      INGRESSO_TICKET_API_BASE_URL: "https://ingresso-ticket.example.test",
    };

    expect(getTicketsApiBaseUrl()).toBe("https://website-ticket.example.test");
  });

  it("falls back to the ingresso ticket api url used by production", () => {
    process.env = {
      ...originalEnv,
      TICKETS_API_BASE_URL: "",
      INGRESSO_TICKET_API_BASE_URL:
        "https://rincaoticketapi-a8buakffcrarc3an.brazilsouth-01.azurewebsites.net/",
    };

    expect(getTicketsApiBaseUrl()).toBe(
      "https://rincaoticketapi-a8buakffcrarc3an.brazilsouth-01.azurewebsites.net",
    );
  });

  it("uses the Rincao Azure ticket api as the default", () => {
    process.env = {
      ...originalEnv,
      TICKETS_API_BASE_URL: "",
      INGRESSO_TICKET_API_BASE_URL: "",
    };

    expect(getTicketsApiBaseUrl()).toBe(defaultTicketsApiBaseUrl);
    expect(getTicketsApiBaseUrl()).toBe(
      "https://rincaoticketapi-a8buakffcrarc3an.brazilsouth-01.azurewebsites.net",
    );
  });
});

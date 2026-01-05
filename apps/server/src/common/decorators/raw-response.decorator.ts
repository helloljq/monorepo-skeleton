import { SetMetadata } from "@nestjs/common";

export const RAW_RESPONSE_KEY = "RAW_RESPONSE";
export const RawResponse = () => SetMetadata(RAW_RESPONSE_KEY, true);

import {
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Patch,
  Put,
} from "@nestjs/common";
import { IdentityService } from "../identity/identity.service.js";
import {
  CreatorProfileService,
  type ProfileInput,
  type ProfilePatch,
} from "./creator-profile.service.js";

@Controller("creator/profile")
export class CreatorProfileController {
  constructor(
    @Inject(CreatorProfileService)
    private readonly profiles: CreatorProfileService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Get()
  async get(@Headers("authorization") authorization?: string) {
    return this.profiles.get(
      (await this.identity.authenticate(bearerToken(authorization))).id,
    );
  }

  @Put()
  async replace(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ProfileInput,
  ) {
    return this.profiles.replace(
      (await this.identity.authenticate(bearerToken(authorization))).id,
      body,
    );
  }

  @Patch()
  async patch(
    @Headers("authorization") authorization: string | undefined,
    @Body() body: ProfilePatch,
  ) {
    return this.profiles.patch(
      (await this.identity.authenticate(bearerToken(authorization))).id,
      body,
    );
  }
}

function bearerToken(authorization?: string) {
  const [scheme, token] = (authorization ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? "") : "";
}

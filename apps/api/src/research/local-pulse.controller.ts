import { Controller, Get, Headers, Inject } from "@nestjs/common";
import { IdentityService } from "../identity/identity.service.js";
import { LocalPulseService } from "./local-pulse.service.js";

@Controller("local-pulse")
export class LocalPulseController {
  constructor(
    @Inject(LocalPulseService) private readonly pulse: LocalPulseService,
    @Inject(IdentityService) private readonly identity: IdentityService,
  ) {}

  @Get()
  async get(@Headers("authorization") authorization?: string) {
    const user = await this.identity.authenticate(bearerToken(authorization));
    return this.pulse.getForCreator(user.id);
  }
}

function bearerToken(authorization?: string) {
  const [scheme, token] = (authorization ?? "").split(" ");
  return scheme?.toLowerCase() === "bearer" ? (token ?? "") : "";
}

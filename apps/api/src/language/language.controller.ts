import { Controller, Get } from "@nestjs/common";
import { LANGUAGE_CATALOG } from "@creator-pulse/contracts";

@Controller("languages")
export class LanguageController {
  @Get()
  list() {
    return LANGUAGE_CATALOG.map(
      ({
        id,
        code,
        name,
        nativeName,
        dialect,
        script,
        supportsControlledCodeSwitching,
      }) => ({
        id,
        code,
        name,
        nativeName,
        dialect,
        script,
        supportsControlledCodeSwitching,
      }),
    );
  }
}

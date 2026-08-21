import { privacyRepository } from "./privacy-repository.mjs";
import { createPrivacyService } from "./privacy-service-core.mjs";

export const privacyService = createPrivacyService(privacyRepository);

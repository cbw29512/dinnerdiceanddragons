import { createOpportunityAlertService } from "./opportunity-alert-core.mjs";
import { opportunityAlertRepository } from "./opportunity-alert-repository.mjs";

export const opportunityAlerts = createOpportunityAlertService(opportunityAlertRepository);

import { Router } from 'express';
import { urlencoded } from 'express';
import { registerSetupRoutes } from './controllers/setupController.js';
import { registerAuthRoutes } from './controllers/authController.js';
import { registerOverviewRoutes } from './controllers/overviewController.js';
import { registerInvitesRoutes } from './controllers/invitesController.js';
import { registerMembersRoutes } from './controllers/membersController.js';

const router = Router();

router.use(urlencoded({ extended: false }));

registerSetupRoutes(router);
registerAuthRoutes(router);
registerOverviewRoutes(router);
registerInvitesRoutes(router);
registerMembersRoutes(router);

export default router;

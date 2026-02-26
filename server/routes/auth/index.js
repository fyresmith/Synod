import { Router, urlencoded } from 'express';
import { registerClaimRoutes } from './controllers/claimController.js';
import { registerBundleRoutes } from './controllers/bundleController.js';
import { registerBootstrapRoutes } from './controllers/bootstrapController.js';

const router = Router();

router.use(urlencoded({ extended: false }));

registerClaimRoutes(router);
registerBundleRoutes(router);
registerBootstrapRoutes(router);

export default router;

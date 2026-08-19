import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import vendorsRouter from "./vendors";
import productsRouter from "./products";
import categoriesRouter from "./categories";
import wardrobeRouter from "./wardrobe";
import ordersRouter from "./orders";
import paymentsRouter from "./payments";
import couponsRouter from "./coupons";
import referralsRouter from "./referrals";
import reviewsRouter from "./reviews";
import storefrontRouter from "./storefront";
import adminRouter from "./admin";
import storageRouter from "./storage";
import mediaRouter from "./media";
import vendorOperationsRouter from "./vendor-operations";

const router: IRouter = Router();

router.use(healthRouter);
router.use(authRouter);
router.use(vendorsRouter);
router.use(productsRouter);
router.use(categoriesRouter);
router.use(wardrobeRouter);
router.use(ordersRouter);
router.use(paymentsRouter);
router.use(couponsRouter);
router.use(referralsRouter);
router.use(reviewsRouter);
router.use(storefrontRouter);
router.use(adminRouter);
router.use(storageRouter);
router.use(mediaRouter);
router.use(vendorOperationsRouter);

export default router;

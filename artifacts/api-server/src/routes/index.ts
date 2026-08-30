import { Router, type IRouter } from "express";
import healthRouter from "./health";
import sensorsRouter from "./sensors";
import projectsRouter from "./projects";
import tutorRouter from "./tutor";
import modulesRouter from "./modules";
import cartRouter from "./cart";
import { debugRouter } from "./debug";
import { summarizeRouter } from "./summarize";
import adminRouter from "./admin";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sensorsRouter);
router.use(projectsRouter);
router.use(tutorRouter);
router.use(modulesRouter);
router.use(cartRouter);
router.use(debugRouter);
router.use(summarizeRouter);
router.use(adminRouter);

export default router;

import express, { Router } from 'express';
import billingController from '../controllers/BillingController';

const router = Router();

router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  billingController.handleStripeWebhook.bind(billingController)
);

export default router;

// lib/commands/index.ts — registry command. API route chỉ gọi qua đây.
import type { CommandDef } from './base';
import { createLead } from './createLead';
import { leadTransition } from './leadTransition';
import { assignVehicleDriver } from './assignVehicleDriver';

export const COMMANDS: Record<string, CommandDef<any>> = {
  [createLead.name]: createLead,
  [leadTransition.name]: leadTransition,
  [assignVehicleDriver.name]: assignVehicleDriver,
  // Slice 2-4 bổ sung: create_quote, send_quote, record_deposit, confirm_order,
  // create_order, prepare_trip, start_trip, finish_trip, record_payment,
  // record_expense, settle_order, cancel_order, approve_discount, approve_debt,
  // record_financial_adjustment — theo cùng khung base.execute.
};

export { execute } from './base';

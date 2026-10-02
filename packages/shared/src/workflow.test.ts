import { describe, expect, it } from 'vitest';
import {
  allowedOrderTransitions,
  canTransitionGarment,
  canTransitionOrder,
  canTransitionTask,
  nextOrderStage,
  permissionForOrderTransition,
} from './workflow';
import { permissionsForRole, roleHasPermission } from './permissions';

describe('order workflow', () => {
  it('follows the default stages', () => {
    expect(nextOrderStage('RECEIVED')).toBe('PROCESSING');
    expect(nextOrderStage('PROCESSING')).toBe('QUALITY_CHECK');
    expect(nextOrderStage('QUALITY_CHECK')).toBe('READY');
    expect(nextOrderStage('READY')).toBe('DELIVERED');
    expect(nextOrderStage('DELIVERED')).toBeNull();
  });

  it('rejects invalid transitions', () => {
    expect(canTransitionOrder('RECEIVED', 'READY')).toBe(false);
    expect(canTransitionOrder('RECEIVED', 'DELIVERED')).toBe(false);
    expect(canTransitionOrder('DELIVERED', 'PROCESSING')).toBe(false);
    expect(canTransitionOrder('CANCELLED', 'RECEIVED')).toBe(false);
    expect(canTransitionOrder('READY', 'CANCELLED')).toBe(false);
  });

  it('allows rework from quality check', () => {
    expect(canTransitionOrder('QUALITY_CHECK', 'PROCESSING')).toBe(true);
  });

  it('supports skipping quality check when configured', () => {
    expect(canTransitionOrder('PROCESSING', 'READY')).toBe(false);
    expect(canTransitionOrder('PROCESSING', 'READY', { skipQualityCheck: true })).toBe(true);
    expect(allowedOrderTransitions('PROCESSING', { skipQualityCheck: true })).toEqual(['QUALITY_CHECK', 'READY', 'CANCELLED']);
  });

  it('maps transitions to permissions', () => {
    expect(permissionForOrderTransition('DELIVERED')).toBe('orders.deliver');
    expect(permissionForOrderTransition('CANCELLED')).toBe('orders.cancel');
    expect(permissionForOrderTransition('READY')).toBe('orders.process');
  });

  it('keeps garments within processing stages', () => {
    expect(canTransitionGarment('RECEIVED', 'READY')).toBe(true);
    expect(canTransitionGarment('READY', 'DELIVERED')).toBe(false);
    expect(canTransitionGarment('READY', 'READY')).toBe(false);
  });
});

describe('task workflow', () => {
  it('distinguishes pickup and delivery flows', () => {
    expect(canTransitionTask('PICKUP', 'ASSIGNED', 'OUT_FOR_PICKUP')).toBe(true);
    expect(canTransitionTask('PICKUP', 'OUT_FOR_PICKUP', 'PICKED_UP')).toBe(true);
    expect(canTransitionTask('PICKUP', 'ASSIGNED', 'OUT_FOR_DELIVERY')).toBe(false);
    expect(canTransitionTask('DELIVERY', 'OUT_FOR_DELIVERY', 'DELIVERED')).toBe(true);
    expect(canTransitionTask('DELIVERY', 'DELIVERED', 'FAILED')).toBe(false);
  });
});

describe('role permissions', () => {
  it('gives owners everything and drivers only their tasks', () => {
    expect(roleHasPermission('OWNER', 'settings.manage')).toBe(true);
    expect(roleHasPermission('MANAGER', 'settings.manage')).toBe(false);
    expect(roleHasPermission('MANAGER', 'reports.view')).toBe(true);
    expect(permissionsForRole('DRIVER')).toEqual(['tasks.view_own', 'tasks.update_status']);
  });

  it('prevents counter staff from refunds, cancellation and reports', () => {
    expect(roleHasPermission('COUNTER_STAFF', 'payments.create')).toBe(true);
    expect(roleHasPermission('COUNTER_STAFF', 'payments.refund')).toBe(false);
    expect(roleHasPermission('COUNTER_STAFF', 'orders.cancel')).toBe(false);
    expect(roleHasPermission('COUNTER_STAFF', 'reports.view')).toBe(false);
  });

  it('limits processing staff to garment work', () => {
    expect(roleHasPermission('PROCESSING_STAFF', 'garments.update')).toBe(true);
    expect(roleHasPermission('PROCESSING_STAFF', 'payments.create')).toBe(false);
    expect(roleHasPermission('PROCESSING_STAFF', 'orders.deliver')).toBe(false);
  });
});

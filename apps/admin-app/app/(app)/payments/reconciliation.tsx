import React from 'react';
import { colors } from '@yaanam/ui';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { Placeholder } from '../../../components/widgets';
import { SUBNAV } from '../../../lib/nav';

export default function ReconciliationScreen() {
  return (
    <AdminScreen
      title="Payments"
      subtitle="Reconciliation"
      subnav={<SubNav segments={SUBNAV.payments} value="reconciliation" />}
    >
      <Placeholder
        icon="🔄"
        tint={colors.warningBg}
        title="Payment reconciliation coming soon"
        description="The gateway mismatch queue and reconciliation tools are being built in Phase 5."
      />
    </AdminScreen>
  );
}

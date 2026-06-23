import React from 'react';
import { colors } from '@yaanam/ui';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { Placeholder } from '../../../components/widgets';
import { SUBNAV } from '../../../lib/nav';

export default function FeePlansScreen() {
  return (
    <AdminScreen
      title="Payments"
      subtitle="Fee plans"
      subnav={<SubNav segments={SUBNAV.payments} value="fee-plans" />}
    >
      <Placeholder
        icon="🧾"
        tint={colors.primaryBg}
        title="Fee plans coming soon"
        description="Define per-route and per-grade fee plans, billing cycles, and due dates here."
      />
    </AdminScreen>
  );
}

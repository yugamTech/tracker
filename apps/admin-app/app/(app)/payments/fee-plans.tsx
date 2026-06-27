import React from 'react';
import { View } from 'react-native';
import { colors, EmptyState, IconSplat } from '@yaanam/ui';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { SUBNAV } from '../../../lib/nav';

export default function FeePlansScreen() {
  return (
    <AdminScreen
      title="Payments"
      subtitle="Fee plans"
      subnav={<SubNav segments={SUBNAV.payments} value="fee-plans" />}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon={<IconSplat shape="b1" splatColor={colors.payBg} spot="card" size={64} />}
          title="Fee plans coming soon"
          description="Define per-route and per-grade fee plans, billing cycles, and due dates here."
        />
      </View>
    </AdminScreen>
  );
}

import React from 'react';
import { View } from 'react-native';
import { colors, EmptyState, IconSplat } from '@yaanam/ui';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { SUBNAV } from '../../../lib/nav';

export default function ReconciliationScreen() {
  return (
    <AdminScreen
      title="Payments"
      subtitle="Reconciliation"
      subnav={<SubNav segments={SUBNAV.payments} value="reconciliation" />}
    >
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <EmptyState
          icon={<IconSplat shape="b4" splatColor={colors.payBg} spot="card" size={64} />}
          title="Payment reconciliation coming soon"
          description="The gateway mismatch queue and reconciliation tools are being built in Phase 5."
        />
      </View>
    </AdminScreen>
  );
}

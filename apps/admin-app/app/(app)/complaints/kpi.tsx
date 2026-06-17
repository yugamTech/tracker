import React from 'react';
import { colors } from '@saarthi/ui';
import { AdminScreen } from '../../../components/AdminScreen';
import { SubNav } from '../../../components/SubNav';
import { Placeholder } from '../../../components/widgets';
import { SUBNAV } from '../../../lib/nav';

export default function ComplaintKpiScreen() {
  return (
    <AdminScreen
      title="Complaints"
      subtitle="Service KPIs"
      subnav={<SubNav segments={SUBNAV.complaints} value="kpi" />}
    >
      <Placeholder
        icon="📉"
        tint={colors.infoBg}
        title="Complaint analytics coming soon"
        description="SLA health, by-driver / route breakdowns, and resolution ratings will appear here in a later phase."
      />
    </AdminScreen>
  );
}

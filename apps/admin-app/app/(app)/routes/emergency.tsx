import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import {
  colors, spacing, radius, fontSizes, fontWeights, letterSpacing,
  Card, Badge, Skeleton, EmptyState,
} from '@yaanam/ui';
import { useEmergencyDirectory } from '@yaanam/api-client';
import type { EmergencyRouteEntry } from '@yaanam/api-client';
import { AdminScreen } from '../../../components/AdminScreen';
import { SearchField } from '../../../components/SearchField';
import { SubNav } from '../../../components/SubNav';
import { GridList } from '../../../components/widgets';
import { useResponsive } from '../../../hooks/useResponsive';
import { SUBNAV } from '../../../lib/nav';

/**
 * Emergency "who's on which bus/route" directory (fleet-integrity §3). Search by
 * route or bus, then call the driver, conductor or any teacher aboard. Crew comes
 * from today's / live trips; teachers from the route's staff assignments.
 */
export default function EmergencyDirectoryScreen() {
  const { data, isLoading } = useEmergencyDirectory();
  const { gridColumns } = useResponsive();
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const list = (data ?? []).filter(
    (e) =>
      !q ||
      e.routeName.toLowerCase().includes(q) ||
      (e.vehicle?.regNumber.toLowerCase().includes(q) ?? false),
  );

  return (
    <AdminScreen
      title="Routes"
      subtitle="Emergency contacts"
      subnav={<SubNav segments={SUBNAV.routes} value="emergency" />}
    >
      <View style={styles.root}>
        <View style={styles.searchRow}>
          <SearchField value={search} onChangeText={setSearch} placeholder="Search route or bus number…" />
          <Text style={styles.helpText}>Tap a name to call. Crew is from today's / live trips.</Text>
        </View>

        {isLoading ? (
          <View style={styles.skeletonWrap}>
            {[0, 1, 2].map((i) => (
              <Card key={i} shadow="sm" style={styles.skeletonCard}>
                <Skeleton width="55%" height={18} />
                <Skeleton width="100%" height={56} style={{ marginTop: 16 }} />
              </Card>
            ))}
          </View>
        ) : (
          <GridList
            data={list}
            columns={gridColumns}
            keyExtractor={(e) => e.routeId}
            ListEmptyComponent={
              <View style={styles.emptyWrap}>
                <EmptyState
                  icon={<Text style={{ fontSize: 40 }}>🆘</Text>}
                  title={search ? 'No routes match' : 'No routes yet'}
                  description={
                    search
                      ? 'Try a different route or bus number.'
                      : 'Add routes and assign buses, drivers and teachers to see emergency contacts here.'
                  }
                />
              </View>
            }
            renderItem={(item) => <RouteContactCard entry={item} />}
          />
        )}
      </View>
    </AdminScreen>
  );
}

function RouteContactCard({ entry }: { entry: EmergencyRouteEntry }) {
  const hasContacts = entry.drivers.length > 0 || entry.conductors.length > 0 || entry.teachers.length > 0;
  return (
    <Card shadow="sm" style={styles.card}>
      <View style={styles.cardTop}>
        <Text style={styles.routeName} numberOfLines={1}>{entry.routeName}</Text>
        <Badge label={entry.direction} variant="default" size="sm" />
        {entry.status !== 'ACTIVE' ? <Badge label={entry.status} variant="inactive" size="sm" /> : null}
      </View>

      <Text style={styles.busLine} numberOfLines={1}>
        {entry.vehicle
          ? `🚍 ${entry.vehicle.regNumber} · ${entry.seatsUsed}/${entry.capacity ?? entry.vehicle.capacity} seats`
          : '🚍 No bus assigned'}
      </Text>

      {!hasContacts ? (
        <Text style={styles.emptyContacts}>No driver, conductor or teacher on record for this route.</Text>
      ) : (
        <>
          <ContactGroup title="Driver" people={entry.drivers.map((d) => ({ name: d.name, phone: d.phone, role: 'Driver' }))} />
          <ContactGroup title="Conductor" people={entry.conductors.map((c) => ({ name: c.name, phone: c.phone, role: 'Conductor' }))} />
          <ContactGroup
            title="Teachers / staff aboard"
            people={entry.teachers.map((t) => ({ name: t.name, phone: t.phone, role: roleLabel(t.role) }))}
          />
        </>
      )}
    </Card>
  );
}

function ContactGroup({ title, people }: { title: string; people: { name: string; phone: string | null; role: string }[] }) {
  if (people.length === 0) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      {people.map((p, i) => (
        <ContactRow key={`${p.name}-${i}`} name={p.name} phone={p.phone} role={p.role} />
      ))}
    </View>
  );
}

function ContactRow({ name, phone, role }: { name: string; phone: string | null; role: string }) {
  return (
    <TouchableOpacity
      style={styles.contactRow}
      onPress={() => phone && Linking.openURL(`tel:${phone}`)}
      activeOpacity={phone ? 0.7 : 1}
      disabled={!phone}
    >
      <View style={styles.contactInfo}>
        <Text style={styles.contactName} numberOfLines={1}>{name}</Text>
        <Text style={styles.contactMeta} numberOfLines={1}>
          {role}{phone ? ` · ${phone}` : ' · no phone on file'}
        </Text>
      </View>
      {phone ? (
        <View style={styles.callBtn}>
          <Text style={styles.callBtnText}>📞 Call</Text>
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

/** Make a raw membership role readable (TRANSPORT_MANAGER → Transport manager). */
function roleLabel(role: string): string {
  const lower = role.replace(/_/g, ' ').toLowerCase();
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  searchRow: { paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[2] },
  helpText: { fontSize: fontSizes.xs, color: colors.textMuted },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 320, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  card: { gap: spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  routeName: { flex: 1, fontSize: fontSizes.lg, fontWeight: fontWeights.bold, color: colors.textPrimary, letterSpacing: letterSpacing.tight },
  busLine: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  emptyContacts: { fontSize: fontSizes.sm, color: colors.textMuted, fontStyle: 'italic' },

  group: { gap: spacing[2] },
  groupTitle: { fontSize: fontSizes.xs, fontWeight: fontWeights.bold, color: colors.textMuted, textTransform: 'uppercase', letterSpacing: letterSpacing.wide },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.backgroundMuted, borderRadius: radius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  contactInfo: { flex: 1 },
  contactName: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  contactMeta: { fontSize: fontSizes.sm, color: colors.textSecondary, marginTop: 2 },
  callBtn: { backgroundColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  callBtnText: { fontSize: fontSizes.sm, fontWeight: fontWeights.semibold, color: colors.white },
});

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import {
  colors, spacing, fontSizes, fontWeights, fontFamilies,
  Card, Badge, Skeleton, EmptyState, IconSplat, Icon,
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
              <Card key={i} shadow="sm" radius={22} style={styles.skeletonCard}>
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
                  icon={<IconSplat shape="b3" splatColor={colors.critBg} icon="phone" iconColor={colors.crit} size={64} />}
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
    <Card shadow="sm" radius={22} style={styles.card}>
      <View style={styles.cardTop}>
        <IconSplat shape="b2" splatColor={colors.routeBg} spot="route" size={42} />
        <Text style={styles.routeName} numberOfLines={1}>{entry.routeName}</Text>
        <Badge label={entry.direction} variant="default" size="sm" />
        {entry.status !== 'ACTIVE' ? <Badge label={entry.status} variant="inactive" size="sm" /> : null}
      </View>

      <View style={styles.busRow}>
        <Icon name="bus" size={15} color={colors.ink3} />
        <Text style={styles.busLine} numberOfLines={1}>
          {entry.vehicle
            ? `${entry.vehicle.regNumber} · ${entry.seatsUsed}/${entry.capacity ?? entry.vehicle.capacity} seats`
            : 'No bus assigned'}
        </Text>
      </View>

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
      <Text style={styles.groupTitle}>{title.toUpperCase()}</Text>
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
          <Icon name="phone" size={14} color={colors.white} />
          <Text style={styles.callBtnText}>Call</Text>
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
  helpText: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.xs, color: colors.ink3 },
  skeletonWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], padding: spacing[4] },
  skeletonCard: { width: 320, flexGrow: 1 },
  emptyWrap: { flex: 1, minHeight: 320 },

  card: { gap: spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  routeName: { flex: 1, fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.lg, fontWeight: fontWeights.extrabold, color: colors.ink, letterSpacing: -0.3 },
  busRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  busLine: { flex: 1, fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, fontWeight: fontWeights.medium },
  emptyContacts: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink3, fontStyle: 'italic' },

  group: { gap: spacing[2] },
  groupTitle: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.xs, fontWeight: fontWeights.extrabold, color: colors.ink3, letterSpacing: 0.5 },
  contactRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.ground, borderRadius: 14,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  contactInfo: { flex: 1 },
  contactName: { fontFamily: fontFamilies.display, fontSize: fontSizes.base, fontWeight: fontWeights.bold, color: colors.ink },
  contactMeta: { fontFamily: fontFamilies.bodySemibold, fontSize: fontSizes.sm, color: colors.ink2, marginTop: 2 },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.people, borderRadius: 12, paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  callBtnText: { fontFamily: fontFamilies.displayHeavy, fontSize: fontSizes.sm, fontWeight: fontWeights.extrabold, color: colors.white },
});

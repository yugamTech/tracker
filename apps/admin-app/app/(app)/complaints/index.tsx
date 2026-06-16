import React, { useState } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity, ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import { router } from 'expo-router';
import { colors, spacing, fontSizes, fontWeights, radius, Card, Badge } from '@saarthi/ui';
import { useAllComplaints, useRoutes, useMembers } from '@saarthi/api-client';
import type { ComplaintFilters } from '@saarthi/api-client';

const STATUS_V: Record<string, 'warning' | 'info' | 'success' | 'default'> = {
  RECEIVED: 'warning', IN_PROGRESS: 'info', RESOLVED: 'success', CLOSED: 'default',
};

const STATUS_OPTIONS = ['ALL', 'RECEIVED', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'];
const CATEGORY_OPTIONS = ['ALL', 'TIMING', 'BEHAVIOUR', 'SAFETY', 'VEHICLE', 'ROUTE', 'OTHER'];

export default function AdminComplaintsScreen() {
  const [showFilters, setShowFilters] = useState(false);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [routeId, setRouteId] = useState('');
  const [driverId, setDriverId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

  const filters: ComplaintFilters = {
    ...(status && { status }),
    ...(category && { category }),
    ...(routeId && { routeId }),
    ...(driverId && { driverId }),
    ...(dateFrom && { dateFrom }),
    ...(dateTo && { dateTo }),
  };

  const { data: complaints = [], isLoading } = useAllComplaints(filters);
  const { data: routes = [] } = useRoutes();
  const { data: drivers = [] } = useMembers('DRIVER');

  const activeFilterCount = [status, category, routeId, driverId, dateFrom, dateTo].filter(Boolean).length;

  const clearFilters = () => {
    setStatus('');
    setCategory('');
    setRouteId('');
    setDriverId('');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <View style={styles.container}>
      {/* Filter toggle */}
      <View style={styles.filterToggleRow}>
        <TouchableOpacity
          style={[styles.filterToggleBtn, activeFilterCount > 0 && styles.filterToggleBtnActive]}
          onPress={() => setShowFilters((v) => !v)}
        >
          <Text style={[styles.filterToggleText, activeFilterCount > 0 && styles.filterToggleTextActive]}>
            🔽 Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
          </Text>
        </TouchableOpacity>
        {activeFilterCount > 0 && (
          <TouchableOpacity onPress={clearFilters} style={styles.clearBtn}>
            <Text style={styles.clearBtnText}>Clear all</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Collapsible filter panel */}
      {showFilters && (
        <View style={styles.filterPanel}>
          <Text style={styles.filterLabel}>Status</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {STATUS_OPTIONS.map((s) => {
              const val = s === 'ALL' ? '' : s;
              return (
                <TouchableOpacity
                  key={s}
                  style={[styles.chip, status === val && styles.chipActive]}
                  onPress={() => setStatus(val)}
                >
                  <Text style={[styles.chipText, status === val && styles.chipTextActive]}>
                    {s.replace('_', ' ')}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {CATEGORY_OPTIONS.map((c) => {
              const val = c === 'ALL' ? '' : c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[styles.chip, category === val && styles.chipActive]}
                  onPress={() => setCategory(val)}
                >
                  <Text style={[styles.chipText, category === val && styles.chipTextActive]}>
                    {c}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={styles.filterLabel}>Route</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !routeId && styles.chipActive]}
              onPress={() => setRouteId('')}
            >
              <Text style={[styles.chipText, !routeId && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {(routes as any[]).map((r: any) => (
              <TouchableOpacity
                key={r.id}
                style={[styles.chip, routeId === r.id && styles.chipActive]}
                onPress={() => setRouteId(r.id)}
              >
                <Text style={[styles.chipText, routeId === r.id && styles.chipTextActive]} numberOfLines={1}>
                  {r.name}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Driver</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            <TouchableOpacity
              style={[styles.chip, !driverId && styles.chipActive]}
              onPress={() => setDriverId('')}
            >
              <Text style={[styles.chipText, !driverId && styles.chipTextActive]}>All</Text>
            </TouchableOpacity>
            {(drivers as any[]).map((d: any) => (
              <TouchableOpacity
                key={d.personId ?? d.id}
                style={[styles.chip, driverId === (d.personId ?? d.id) && styles.chipActive]}
                onPress={() => setDriverId(d.personId ?? d.id)}
              >
                <Text style={[styles.chipText, driverId === (d.personId ?? d.id) && styles.chipTextActive]} numberOfLines={1}>
                  {d.person?.name ?? d.name ?? 'Driver'}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          <Text style={styles.filterLabel}>Date range (YYYY-MM-DD)</Text>
          <View style={styles.dateRow}>
            <TextInput
              style={styles.dateInput}
              value={dateFrom}
              onChangeText={setDateFrom}
              placeholder="From"
              placeholderTextColor={colors.gray400}
            />
            <Text style={{ color: colors.textMuted }}>–</Text>
            <TextInput
              style={styles.dateInput}
              value={dateTo}
              onChangeText={setDateTo}
              placeholder="To"
              placeholderTextColor={colors.gray400}
            />
          </View>
        </View>
      )}

      {isLoading ? (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={complaints}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', marginTop: 60 }}>
              <Text style={{ color: colors.textSecondary }}>No complaints match these filters.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const trip = (item as any).trip;
            const route = trip?.route;
            return (
              <TouchableOpacity activeOpacity={0.85} onPress={() => router.push(`/(app)/complaints/${item.id}` as never)}>
                <Card style={styles.card}>
                  <View style={styles.cardTop}>
                    <Text style={styles.category}>{item.category.replace('_', ' ')}</Text>
                    <Badge label={item.status.replace('_', ' ')} variant={STATUS_V[item.status] ?? 'default'} size="sm" />
                  </View>
                  <Text style={styles.desc}>{item.description ?? '—'}</Text>
                  {route && (
                    <Text style={styles.routeTag}>🛣️ {route.name} · {trip.direction === 'PICKUP' ? 'Pickup' : 'Drop'}</Text>
                  )}
                  <View style={styles.footer}>
                    <Text style={styles.student}>
                      {(item as any).student ? `👤 ${(item as any).student.name ?? ''}` : ''}
                    </Text>
                    <Text style={styles.date}>
                      {new Date(item.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </Text>
                  </View>
                </Card>
              </TouchableOpacity>
            );
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.gray50 },
  filterToggleRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    backgroundColor: colors.white, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  filterToggleBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.white,
  },
  filterToggleBtnActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  filterToggleText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  filterToggleTextActive: { color: colors.primary, fontWeight: fontWeights.semibold },
  clearBtn: { paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  clearBtnText: { fontSize: fontSizes.sm, color: colors.error, fontWeight: fontWeights.medium },
  filterPanel: {
    backgroundColor: colors.white, paddingHorizontal: spacing[4], paddingBottom: spacing[4],
    borderBottomWidth: 1, borderBottomColor: colors.border, gap: spacing[2],
  },
  filterLabel: { fontSize: fontSizes.xs, fontWeight: fontWeights.semibold, color: colors.textMuted, marginTop: spacing[3], textTransform: 'uppercase' },
  chipRow: { gap: spacing[2], paddingVertical: spacing[1] },
  chip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border,
    backgroundColor: colors.gray50,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: '#EEF2FF' },
  chipText: { fontSize: fontSizes.sm, color: colors.textSecondary, fontWeight: fontWeights.medium },
  chipTextActive: { color: colors.primary, fontWeight: fontWeights.semibold },
  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  dateInput: {
    flex: 1, backgroundColor: colors.gray100, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    fontSize: fontSizes.sm, color: colors.textPrimary,
    borderWidth: 1, borderColor: colors.border,
  },
  list: { padding: spacing[4], gap: spacing[3] },
  card: {},
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: spacing[2] },
  category: { fontSize: fontSizes.base, fontWeight: fontWeights.semibold, color: colors.textPrimary },
  desc: { fontSize: fontSizes.sm, color: colors.textSecondary, lineHeight: 20 },
  routeTag: { fontSize: fontSizes.xs, color: colors.primary, marginTop: spacing[2], fontWeight: fontWeights.medium },
  footer: { flexDirection: 'row', justifyContent: 'space-between', marginTop: spacing[3] },
  student: { fontSize: fontSizes.xs, color: colors.textMuted },
  date: { fontSize: fontSizes.xs, color: colors.textMuted },
});

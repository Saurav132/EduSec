import React, { useCallback, useEffect, useRef, useState } from 'react';
import type {
  Alert,
  HealthResponse,
  Incident,
  NavigationTab,
  SecurityEvent,
} from './types';
import { apiClient } from './api/client';
import { Sidebar } from './components/common/Sidebar';
import { Header } from './components/common/Header';
import { OverviewView } from './components/overview/OverviewView';
import { EventsView } from './components/events/EventsView';
import { AlertsView } from './components/alerts/AlertsView';
import { IncidentsView } from './components/incidents/IncidentsView';


export const App: React.FC = () => {
  // Navigation & UI state
  const [currentTab, setCurrentTab] = useState<NavigationTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  // Health state
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);

  // Overview data state
  const [totalEvents, setTotalEvents] = useState<number | null>(null);
  const [totalAlerts, setTotalAlerts] = useState<number | null>(null);
  const [openAlerts, setOpenAlerts] = useState<number | null>(null);
  const [criticalAlerts, setCriticalAlerts] = useState<number | null>(null);
  const [highAlerts, setHighAlerts] = useState<number | null>(null);
  const [recentEvents, setRecentEvents] = useState<SecurityEvent[]>([]);
  const [recentAlerts, setRecentAlerts] = useState<Alert[]>([]);
  const [overviewLoading, setOverviewLoading] = useState<boolean>(true);
  const [overviewError, setOverviewError] = useState<string | null>(null);

  // Events Tab state
  const [eventsList, setEventsList] = useState<SecurityEvent[]>([]);
  const [eventsTotal, setEventsTotal] = useState<number>(0);
  const [eventsPage, setEventsPage] = useState<number>(0);
  const [eventsPageSize, setEventsPageSize] = useState<number>(50);
  const [eventsLoading, setEventsLoading] = useState<boolean>(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [selectedEventModal, setSelectedEventModal] = useState<SecurityEvent | null>(null);

  // Alerts Tab state
  const [alertsList, setAlertsList] = useState<Alert[]>([]);
  const [alertsTotal, setAlertsTotal] = useState<number>(0);
  const [alertsPage, setAlertsPage] = useState<number>(0);
  const [alertsPageSize] = useState<number>(50);
  const [alertsSeverityFilter, setAlertsSeverityFilter] = useState<string>('all');
  const [alertsStatusFilter, setAlertsStatusFilter] = useState<string>('all');
  const [alertsLoading, setAlertsLoading] = useState<boolean>(false);
  const [alertsError, setAlertsError] = useState<string | null>(null);
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null);

  // Incidents Tab state (Phase 6)
  const [incidentsList, setIncidentsList] = useState<Incident[]>([]);
  const [incidentsTotal, setIncidentsTotal] = useState<number>(0);
  const [incidentsSource, setIncidentsSource] = useState<'live_backend' | 'development_fixture'>('live_backend');
  const [incidentsPage, setIncidentsPage] = useState<number>(0);
  const [incidentsPageSize] = useState<number>(50);
  const [incidentsStatusFilter, setIncidentsStatusFilter] = useState<string>('all');

  const [incidentsSeverityFilter, setIncidentsSeverityFilter] = useState<string>('all');
  const [incidentsLoading, setIncidentsLoading] = useState<boolean>(false);
  const [incidentsError, setIncidentsError] = useState<string | null>(null);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(null);
  const [createIncidentModalOpen, setCreateIncidentModalOpen] = useState<boolean>(false);
  const [escalatePreselectedAlertIds, setEscalatePreselectedAlertIds] = useState<string[]>([]);
  const [openIncidentsCount, setOpenIncidentsCount] = useState<number>(0);

  // Detection run state
  const [runningDetection, setRunningDetection] = useState<boolean>(false);
  const [detectionMessage, setDetectionMessage] = useState<string | null>(null);

  // Phase 9: Auto-refresh state & polling guard
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState<boolean>(true);
  const isPollingRef = useRef<boolean>(false);

  /**
   * Fetch health status
   */
  const checkHealth = useCallback(async () => {
    try {
      const data = await apiClient.getHealth();
      setHealth(data);
      setBackendOnline(data.status === 'healthy' && data.database?.ready === true);
    } catch {
      setHealth(null);
      setBackendOnline(false);
    }
  }, []);

  /**
   * Fetch Overview Tab metrics and samples
   */
  const fetchOverviewData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setOverviewLoading(true);
      setOverviewError(null);
    }
    try {
      // Parallel requests using exact X-Total-Count and real endpoints
      const [
        eventsCountRes,
        alertsCountRes,
        openAlertsRes,
        highAlertsRes,
        criticalAlertsRes,
        eventsSampleRes,
        alertsSampleRes,
      ] = await Promise.all([
        apiClient.getEvents({ limit: 1 }),
        apiClient.getAlerts({ limit: 1 }),
        apiClient.getAlerts({ status: 'open', limit: 1 }),
        apiClient.getAlerts({ severity: 'high', limit: 1 }),
        apiClient.getAlerts({ severity: 'critical', limit: 1 }),
        apiClient.getEvents({ limit: 50 }),
        apiClient.getAlerts({ limit: 50 }),
      ]);

      setTotalEvents(eventsCountRes.total);
      setTotalAlerts(alertsCountRes.total);
      setOpenAlerts(openAlertsRes.total);
      setHighAlerts(highAlertsRes.total);
      setCriticalAlerts(criticalAlertsRes.total);
      setRecentEvents(eventsSampleRes.events);
      setRecentAlerts(alertsSampleRes.alerts);
    } catch (err) {
      if (!isBackground) {
        setOverviewError((err as Error).message || 'Failed to fetch overview metrics.');
      }
    } finally {
      if (!isBackground) {
        setOverviewLoading(false);
      }
    }
  }, []);

  /**
   * Fetch paginated events for Events tab
   */
  const fetchEventsData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setEventsLoading(true);
      setEventsError(null);
    }
    try {
      const offset = eventsPage * eventsPageSize;
      const res = await apiClient.getEvents({ limit: eventsPageSize, offset });
      setEventsList(res.events);
      setEventsTotal(res.total);
    } catch (err) {
      if (!isBackground) {
        setEventsError((err as Error).message || 'Failed to load security events.');
      }
    } finally {
      if (!isBackground) {
        setEventsLoading(false);
      }
    }
  }, [eventsPage, eventsPageSize]);

  /**
   * Fetch paginated alerts with filters for Alerts tab
   */
  const fetchAlertsData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setAlertsLoading(true);
      setAlertsError(null);
    }
    try {
      const offset = alertsPage * alertsPageSize;
      const params: Parameters<typeof apiClient.getAlerts>[0] = {
        limit: alertsPageSize,
        offset,
      };
      if (alertsSeverityFilter !== 'all') {
        params.severity = alertsSeverityFilter;
      }
      if (alertsStatusFilter !== 'all') {
        params.status = alertsStatusFilter;
      }

      const res = await apiClient.getAlerts(params);
      setAlertsList(res.alerts);
      setAlertsTotal(res.total);
    } catch (err) {
      if (!isBackground) {
        setAlertsError((err as Error).message || 'Failed to load security alerts.');
      }
    } finally {
      if (!isBackground) {
        setAlertsLoading(false);
      }
    }
  }, [alertsPage, alertsPageSize, alertsSeverityFilter, alertsStatusFilter]);

  /**
   * Fetch paginated incidents for Incidents tab (Phase 6)
   */
  const fetchIncidentsData = useCallback(async (isBackground = false) => {
    if (!isBackground) {
      setIncidentsLoading(true);
      setIncidentsError(null);
    }
    try {
      const offset = incidentsPage * incidentsPageSize;
      const params: Parameters<typeof apiClient.incidents.getIncidents>[0] = {
        limit: incidentsPageSize,
        offset,
      };
      if (incidentsSeverityFilter !== 'all') {
        params.severity = incidentsSeverityFilter;
      }
      if (incidentsStatusFilter !== 'all') {
        params.status = incidentsStatusFilter;
      }

      const res = await apiClient.incidents.getIncidents(params);
      setIncidentsList(res.incidents);
      setIncidentsTotal(res.total);
      setIncidentsSource(res.source);

      // Track active/open count for sidebar badge
      const activeCount = res.incidents.filter(
        (i) => i.status === 'open' || i.status === 'investigating' || i.status === 'contained'
      ).length;
      setOpenIncidentsCount(activeCount);
    } catch (err) {
      if (!isBackground) {
        setIncidentsError((err as Error).message || 'Failed to load security incidents.');
      }
    } finally {
      if (!isBackground) {
        setIncidentsLoading(false);
      }
    }
  }, [incidentsPage, incidentsPageSize, incidentsSeverityFilter, incidentsStatusFilter]);

  // Initial load and periodic health poll
  useEffect(() => {
    checkHealth();
    fetchOverviewData();
    // Pre-fetch count for incidents badge
    apiClient.incidents
      .getIncidents({ limit: 10 })
      .then((res) => {
        const count = res.incidents.filter(
          (i) => i.status === 'open' || i.status === 'investigating' || i.status === 'contained'
        ).length;
        setOpenIncidentsCount(count);
      })
      .catch(() => {});

    const healthInterval = setInterval(checkHealth, 15000);
    return () => clearInterval(healthInterval);
  }, [checkHealth, fetchOverviewData]);

  // Fetch data when switching tabs
  useEffect(() => {
    if (currentTab === 'events') {
      fetchEventsData();
    } else if (currentTab === 'alerts') {
      fetchAlertsData();
    } else if (currentTab === 'incidents') {
      fetchIncidentsData();
    }
  }, [currentTab, fetchEventsData, fetchAlertsData, fetchIncidentsData]);

  // Phase 9: 5-second auto-refresh for the active dashboard tab
  useEffect(() => {
    if (!autoRefreshEnabled) {
      return;
    }

    const pollInterval = 5000;
    let timerId: ReturnType<typeof setTimeout> | null = null;
    let isCancelled = false;

    const runPoll = async () => {
      // Pause polling if the tab is hidden
      if (typeof document !== 'undefined' && document.hidden) {
        scheduleNext();
        return;
      }

      // Prevent overlapping polling requests
      if (isPollingRef.current) {
        scheduleNext();
        return;
      }

      isPollingRef.current = true;
      try {
        if (currentTab === 'overview') {
          await fetchOverviewData(true);
        } else if (currentTab === 'events') {
          await fetchEventsData(true);
        } else if (currentTab === 'alerts') {
          await fetchAlertsData(true);
        } else if (currentTab === 'incidents') {
          await fetchIncidentsData(true);
        }

        // Keep incident count updated for sidebar badge
        apiClient.incidents
          .getIncidents({ limit: 10 })
          .then((res) => {
            if (!isCancelled) {
              const activeCount = res.incidents.filter(
                (i) => i.status === 'open' || i.status === 'investigating' || i.status === 'contained'
              ).length;
              setOpenIncidentsCount(activeCount);
            }
          })
          .catch(() => {});
      } catch {
        // Silently ignore background polling errors
      } finally {
        isPollingRef.current = false;
        if (!isCancelled) {
          scheduleNext();
        }
      }
    };

    const scheduleNext = () => {
      if (!isCancelled) {
        timerId = setTimeout(runPoll, pollInterval);
      }
    };

    timerId = setTimeout(runPoll, pollInterval);

    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && !document.hidden && !isPollingRef.current) {
        if (timerId) clearTimeout(timerId);
        runPoll();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      isCancelled = true;
      if (timerId) {
        clearTimeout(timerId);
      }
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
    };
  }, [
    autoRefreshEnabled,
    currentTab,
    fetchOverviewData,
    fetchEventsData,
    fetchAlertsData,
    fetchIncidentsData,
  ]);

  /**
   * Trigger detection cycle
   */
  const handleRunDetection = async () => {
    setRunningDetection(true);
    try {
      const summary = await apiClient.runDetections();
      setDetectionMessage(
        `Detection run complete: ${summary.events_evaluated} events evaluated, ${summary.alerts_created} new alerts created (${summary.alerts_existing} existing).`
      );
      // Refresh current views
      fetchOverviewData();
      if (currentTab === 'alerts') {
        fetchAlertsData();
      } else if (currentTab === 'incidents') {
        fetchIncidentsData();
      }
      setTimeout(() => setDetectionMessage(null), 6000);
    } catch (err) {
      setDetectionMessage(`Detection engine error: ${(err as Error).message}`);
      setTimeout(() => setDetectionMessage(null), 6000);
    } finally {
      setRunningDetection(false);
    }
  };

  /**
   * Escalate an alert into an incident
   */
  const handleEscalateToIncident = (alertId: string | string[]) => {
    const ids = Array.isArray(alertId) ? alertId : [alertId];
    setEscalatePreselectedAlertIds(Array.from(new Set(ids)));
    setCreateIncidentModalOpen(true);
    setSelectedAlertId(null);
    setCurrentTab('incidents');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Handle newly created incident
   */
  const handleIncidentCreated = (newInc: Incident) => {
    setIncidentsList((prev) => [newInc, ...prev]);
    setIncidentsTotal((prev) => prev + 1);
    setOpenIncidentsCount((prev) => prev + 1);
    setEscalatePreselectedAlertIds([]);
    setDetectionMessage(`Incident "${newInc.id}" created successfully.`);
    setTimeout(() => setDetectionMessage(null), 6000);
  };

  /**
   * Handle incident update
   */
  const handleIncidentUpdated = (updated: Incident) => {
    setIncidentsList((prev) => prev.map((i) => (i.id === updated.id ? updated : i)));
  };

  /**
   * Reset development fixtures
   */
  const handleResetFixtures = () => {
    apiClient.incidents.resetFixtures();
    fetchIncidentsData();
    setDetectionMessage('Development fixtures reset to baseline sample data.');
    setTimeout(() => setDetectionMessage(null), 5000);
  };

  /**
   * Jump to Alerts tab from Incident drawer
   */
  const handleOpenAlertInTab = (alertId: string) => {
    setSelectedIncidentId(null);
    setSelectedAlertId(alertId);
    setCurrentTab('alerts');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  /**
   * Refresh current tab
   */
  const handleRefresh = () => {
    checkHealth();
    if (currentTab === 'overview') {
      fetchOverviewData();
    } else if (currentTab === 'events') {
      fetchEventsData();
    } else if (currentTab === 'alerts') {
      fetchAlertsData();
    } else if (currentTab === 'incidents') {
      fetchIncidentsData();
    }
  };

  // Titles mapping
  const titles: Record<NavigationTab, { title: string; subtitle: string }> = {

    overview: {
      title: 'Security Operations Center (SOC)',
      subtitle: 'Live telemetry, detection metrics, and event activity',
    },
    events: {
      title: 'Security Event Store',
      subtitle: 'Ingested raw security telemetry and audit logs',
    },
    alerts: {
      title: 'Alerts & Detections',
      subtitle: 'Correlated security alerts generated by EduSec rules',
    },
    incidents: {
      title: 'Incident Response & Case Management',
      subtitle: 'Phase 6 incident lifecycle and remediation workflow',
    },
  };

  return (
    <div className="flex min-h-screen bg-[#FAFAF8] text-[#18181B] antialiased selection:bg-[#FEF3C7] selection:text-[#18181B]">
      {/* Sidebar navigation */}
      <Sidebar
        currentTab={currentTab}
        onTabChange={(tab) => {
          setCurrentTab(tab);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        mobileOpen={mobileMenuOpen}
        onMobileClose={() => setMobileMenuOpen(false)}
        backendOnline={backendOnline}
        alertsCount={openAlerts ?? 0}
        incidentsCount={openIncidentsCount}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Top Header */}
        <Header
          onMobileMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)}
          pageTitle={titles[currentTab].title}
          pageSubtitle={titles[currentTab].subtitle}
          health={health}
          loading={overviewLoading || eventsLoading || alertsLoading || incidentsLoading}
          onRefresh={handleRefresh}
          onRunDetection={handleRunDetection}
          runningDetection={runningDetection}
          autoRefreshEnabled={autoRefreshEnabled}
          onToggleAutoRefresh={() => setAutoRefreshEnabled((prev) => !prev)}
        />

        {/* Global Feedback Banner for Detection Runs */}
        {detectionMessage && (
          <div className="border-b border-[#FDE68A] bg-[#FEF3C7] px-6 py-2.5 text-xs text-[#18181B] flex items-center justify-between shadow-xs">
            <span className="font-medium">{detectionMessage}</span>
            <button
              onClick={() => setDetectionMessage(null)}
              className="text-[#A16207] hover:text-[#18181B] font-bold ml-4"
            >
              ✕
            </button>
          </div>
        )}

        {/* Main Content Scroll View */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-[#FAFAF8]">
          <div className="mx-auto max-w-7xl">
            {currentTab === 'overview' && (
              <OverviewView
                totalEvents={totalEvents}
                totalAlerts={totalAlerts}
                openAlerts={openAlerts}
                criticalAlerts={criticalAlerts}
                highAlerts={highAlerts}
                recentEvents={recentEvents}
                recentAlerts={recentAlerts}
                loading={overviewLoading}
                error={overviewError}
                onRefresh={fetchOverviewData}
                onNavigateTab={(tab) => {
                  setCurrentTab(tab);
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                onSelectEvent={(event) => setSelectedEventModal(event)}
                onSelectAlert={(alert) => {
                  setSelectedAlertId(alert.id);
                  setCurrentTab('alerts');
                }}
                onRunDetection={handleRunDetection}
                runningDetection={runningDetection}
              />
            )}

            {currentTab === 'events' && (
              <EventsView
                events={eventsList}
                totalEvents={eventsTotal}
                loading={eventsLoading}
                error={eventsError}
                page={eventsPage}
                pageSize={eventsPageSize}
                onPageChange={(p) => setEventsPage(p)}
                onPageSizeChange={(s) => {
                  setEventsPageSize(s);
                  setEventsPage(0);
                }}
                onRefresh={fetchEventsData}
                selectedEvent={selectedEventModal}
                onSelectEvent={(event) => setSelectedEventModal(event)}
              />
            )}

            {currentTab === 'alerts' && (
              <AlertsView
                alerts={alertsList}
                totalAlerts={alertsTotal}
                loading={alertsLoading}
                error={alertsError}
                severityFilter={alertsSeverityFilter}
                statusFilter={alertsStatusFilter}
                onSeverityFilterChange={(sev) => setAlertsSeverityFilter(sev)}
                onStatusFilterChange={(stat) => setAlertsStatusFilter(stat)}
                page={alertsPage}
                pageSize={alertsPageSize}
                onPageChange={(p) => setAlertsPage(p)}
                onRefresh={fetchAlertsData}
                selectedAlertId={selectedAlertId}
                onSelectAlertId={(id) => setSelectedAlertId(id)}
                onRunDetection={handleRunDetection}
                runningDetection={runningDetection}
                onEscalateToIncident={handleEscalateToIncident}
              />
            )}

            {currentTab === 'incidents' && (
              <IncidentsView
                incidents={incidentsList}
                totalIncidents={incidentsTotal}
                loading={incidentsLoading}
                error={incidentsError}
                source={incidentsSource}
                statusFilter={incidentsStatusFilter}
                severityFilter={incidentsSeverityFilter}
                onStatusFilterChange={(st) => {
                  setIncidentsStatusFilter(st);
                  setIncidentsPage(0);
                }}
                onSeverityFilterChange={(sev) => {
                  setIncidentsSeverityFilter(sev);
                  setIncidentsPage(0);
                }}
                page={incidentsPage}
                pageSize={incidentsPageSize}
                onPageChange={(p) => setIncidentsPage(p)}
                onRefresh={fetchIncidentsData}
                onResetFixtures={handleResetFixtures}
                selectedIncidentId={selectedIncidentId}
                onSelectIncidentId={(id) => setSelectedIncidentId(id)}
                onIncidentCreated={handleIncidentCreated}
                onIncidentUpdated={handleIncidentUpdated}
                onOpenAlertInTab={handleOpenAlertInTab}
                createModalOpen={createIncidentModalOpen}
                onCreateModalOpenChange={(open) => {
                  setCreateIncidentModalOpen(open);
                  if (!open) setEscalatePreselectedAlertIds([]);
                }}
                preSelectedAlertIds={escalatePreselectedAlertIds}
              />
            )}
          </div>
        </main>
      </div>
    </div>

  );
};

export default App;

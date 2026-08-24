'use client'

import { Alert, Block, Button, Checkbox, Empty, Flexbox, Segmented, Tag, Text, Tooltip, toast } from '@lobehub/ui'
import {
  ArrowDown,
  ArrowUp,
  BatteryMedium,
  ChartNoAxesCombined,
  CircleAlert,
  ChevronRight,
  Gauge,
  Monitor,
  Plus,
  Radio,
  RefreshCw,
  Wifi,
} from 'lucide-react'
import { useAtom, useSetAtom } from 'jotai'
import { useTranslations } from 'next-intl'
import { useEffect } from 'react'

import { DevicePreview } from './device-preview'
import { deviceNeedsAttention } from './device-attention'
import { EnrollmentDialog } from './enrollment-dialog'
import {
  beginDeviceCommandAtom,
  commandFeedbackAtom,
  deviceFilterAtom,
  enrollmentOpenAtom,
  pageConfigurationAtom,
  pageLoadingAtom,
  pageSavingAtom,
  previewSvgByDeviceAtom,
  resolveDeviceCommandAtom,
  selectedDeviceIdAtom,
  selectedPreviewIdAtom,
  type DevicePageConfiguration,
} from '@/state/dashboard'
import type { DeviceSummary } from '@/server/devices'

type DeviceDashboardProps = {
  devices: DeviceSummary[]
  summary: { active_alerts: number; source_updates_today: number }
}

const statusColor = (status: DeviceSummary['status']) => {
  if (status === 'online') return 'green'
  if (status === 'error') return 'red'
  if (status === 'offline') return 'default'
  return 'gold'
}

const UsageMeter = ({
  values,
  translate,
}: {
  values: DeviceSummary['source_values']
  translate: ReturnType<typeof useTranslations<'Dashboard'>>
}) => {
  const used = typeof values?.used === 'number' ? values.used : null
  const total = typeof values?.total === 'number' && values.total > 0 ? values.total : null
  const remaining =
    typeof values?.remaining === 'number' ? values.remaining : total !== null && used !== null ? Math.max(0, total - used) : null
  const percent =
    typeof values?.today_percent === 'number'
      ? values.today_percent
      : used !== null && total !== null
        ? Math.min(100, Math.max(0, (used / total) * 100))
        : null
  return (
    <section aria-label={translate('tokenBalance')} className="usage-meter">
      <Flexbox horizontal align="center" justify="space-between" gap={10}>
        <Flexbox horizontal align="center" gap={8}>
          <Gauge aria-hidden size={18} />
          <Text strong>{translate('tokenBalance')}</Text>
        </Flexbox>
        <Text className="usage-meter-value" type="secondary">
          {remaining !== null ? translate('tokensRemaining', { value: remaining }) : translate('unavailable')}
        </Text>
      </Flexbox>
      <div
        aria-label={percent !== null ? translate('usageProgress', { percent: Math.round(percent) }) : translate('usageUnavailable')}
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={percent ?? 0}
        className="usage-progress"
        role="progressbar"
      >
        <span style={{ width: `${percent ?? 0}%` }} />
      </div>
      <Flexbox horizontal align="center" justify="space-between" gap={8}>
        <Text type="secondary">
          {used !== null && total !== null ? translate('tokensUsed', { used, total }) : translate('usageUnavailable')}
        </Text>
        {typeof values?.unit === 'string' && <Text type="secondary">{values.unit}</Text>}
      </Flexbox>
    </section>
  )
}

export const DeviceDashboard = ({ devices, summary }: DeviceDashboardProps) => {
  const [selectedDeviceId, setSelectedDeviceId] = useAtom(selectedDeviceIdAtom)
  const [selectedPreviewId, setSelectedPreviewId] = useAtom(selectedPreviewIdAtom)
  const [commandFeedback, setCommandFeedback] = useAtom(commandFeedbackAtom)
  const translate = useTranslations('Dashboard')
  const beginCommand = useSetAtom(beginDeviceCommandAtom)
  const resolveCommand = useSetAtom(resolveDeviceCommandAtom)
  const [pageConfiguration, setPageConfiguration] = useAtom(pageConfigurationAtom)
  const [pageLoading, setPageLoading] = useAtom(pageLoadingAtom)
  const [pageSaving, setPageSaving] = useAtom(pageSavingAtom)
  const [enrollmentOpen, setEnrollmentOpen] = useAtom(enrollmentOpenAtom)
  const [deviceFilter, setDeviceFilter] = useAtom(deviceFilterAtom)
  const [previewSvgByDevice, setPreviewSvgByDevice] = useAtom(previewSvgByDeviceAtom)
  const visibleDevices = deviceFilter === 'all' ? devices : devices.filter(deviceNeedsAttention)

  const selectDevice = (device: DeviceSummary) => {
    setSelectedDeviceId(device.id)
    setSelectedPreviewId(device.id)
    setCommandFeedback({
      device_id: device.id,
      message: translate('previewSelected', { name: device.name }),
      phase: 'idle',
    })
  }

  useEffect(() => {
    if (!selectedDeviceId) {
      setPageConfiguration(null)
      return
    }
    let cancelled = false
    setPageLoading(true)
    void fetch(`/api/v1/devices/${selectedDeviceId}/pages`, { cache: 'no-store' })
      .then(async (response) => (response.ok ? (response.json() as Promise<DevicePageConfiguration>) : null))
      .then((configuration) => {
        if (!cancelled) setPageConfiguration(configuration)
      })
      .catch(() => {
        if (!cancelled) setPageConfiguration(null)
      })
      .finally(() => {
        if (!cancelled) setPageLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [selectedDeviceId, setPageConfiguration, setPageLoading])

  const togglePage = (pageId: string, checked: boolean) => {
    if (!pageConfiguration) return
    const enabledPageIds = checked
      ? [...pageConfiguration.enabled_page_ids, pageId]
      : pageConfiguration.enabled_page_ids.filter((item) => item !== pageId)
    if (!enabledPageIds.length || enabledPageIds.length > 10) return
    setPageConfiguration({
      ...pageConfiguration,
      enabled_page_ids: enabledPageIds,
      desired_page_id: enabledPageIds.includes(pageConfiguration.desired_page_id) ? pageConfiguration.desired_page_id : enabledPageIds[0],
    })
  }

  const movePage = (pageId: string, direction: -1 | 1) => {
    if (!pageConfiguration) return
    const index = pageConfiguration.enabled_page_ids.indexOf(pageId)
    const nextIndex = index + direction
    if (index < 0 || nextIndex < 0 || nextIndex >= pageConfiguration.enabled_page_ids.length) return
    const enabledPageIds = [...pageConfiguration.enabled_page_ids]
    ;[enabledPageIds[index], enabledPageIds[nextIndex]] = [enabledPageIds[nextIndex], enabledPageIds[index]]
    setPageConfiguration({ ...pageConfiguration, enabled_page_ids: enabledPageIds })
  }

  const savePages = async () => {
    if (!selectedDeviceId || !pageConfiguration) return
    setPageSaving(true)
    try {
      const response = await fetch(`/api/v1/devices/${selectedDeviceId}/pages`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled_page_ids: pageConfiguration.enabled_page_ids, desired_page_id: pageConfiguration.desired_page_id }),
      })
      if (!response.ok) throw new Error('page_configuration_rejected')
      setPageConfiguration((await response.json()) as DevicePageConfiguration)
      toast.success(translate('pagesSaved'))
    } catch {
      toast.error(translate('pagesSaveFailed'))
    } finally {
      setPageSaving(false)
    }
  }

  const refreshPreview = async (device: DeviceSummary) => {
    beginCommand(device.id)
    try {
      const response = await fetch(`/api/v1/devices/${device.id}/preview`, { cache: 'no-store' })
      if (!response.ok) throw new Error(translate('previewRejected'))
      const previewSvg = await response.text()
      setPreviewSvgByDevice((previews) => ({ ...previews, [device.id]: previewSvg }))
      resolveCommand({ device_id: device.id, message: translate('previewCurrent'), phase: 'accepted' })
      toast.success(translate('previewRefreshed'))
    } catch (error) {
      const message = error instanceof Error ? error.message : translate('previewRefreshFailed')
      resolveCommand({ device_id: device.id, message, phase: 'error' })
      toast.error(translate('previewRefreshFailed'))
    }
  }

  return (
    <main className="dashboard-shell">
      <header className="dashboard-header">
        <Flexbox className="dashboard-introduction" gap={10}>
          <Text className="eyebrow">
            <Radio aria-hidden />
            {translate('controlPlane')}
          </Text>
          <h1>{translate('title')}</h1>
          <Text className="header-subtitle">{translate('subtitle')}</Text>
        </Flexbox>
        <Flexbox className="header-actions" gap={14}>
          <Button aria-label={translate('addDevice')} icon={Plus} onClick={() => setEnrollmentOpen(true)} size="large" type="primary">
            {translate('addDevice')}
          </Button>
        </Flexbox>
      </header>

      <section aria-label={translate('systemSummary')} className="summary-grid">
        <Block className="summary-item" variant="outlined">
          <Monitor aria-hidden className="summary-icon" />
          <strong>{devices.length}</strong>
          <Text type="secondary">{translate('registeredDevices')}</Text>
        </Block>
        <Block className="summary-item" variant="outlined">
          <CircleAlert aria-hidden className="summary-icon" />
          <strong>{summary.active_alerts}</strong>
          <Text type="secondary">{translate('activeAlerts')}</Text>
        </Block>
        <Block className="summary-item" variant="outlined">
          <ChartNoAxesCombined aria-hidden className="summary-icon" />
          <strong>{summary.source_updates_today}</strong>
          <Text type="secondary">{translate('sourceUpdatesToday')}</Text>
        </Block>
      </section>

      <section aria-labelledby="devices-heading" className="devices-section">
        <Flexbox className="section-header" horizontal align="center" justify="space-between" gap={16} wrap="wrap">
          <Flexbox gap={4}>
            <h2 id="devices-heading">{translate('devices')}</h2>
            <Text type="secondary">{translate('devicesDescription')}</Text>
          </Flexbox>
          <Segmented
            aria-label={translate('devices')}
            options={[
              { label: translate('allDevices'), value: 'all' },
              { label: translate('needsAttention'), value: 'attention' },
            ]}
            onChange={(value) => setDeviceFilter(value as 'all' | 'attention')}
            value={deviceFilter}
          />
        </Flexbox>

        {visibleDevices.length === 0 ? (
          <Empty
            className="empty-state"
            emoji="🖥️"
            title={translate('noDevices')}
            description={translate('noDevicesDescription')}
            action={
              <Button icon={Plus} onClick={() => setEnrollmentOpen(true)} type="primary">
                {translate('addDevice')}
              </Button>
            }
          />
        ) : (
          <Flexbox className="device-list" gap={16}>
            {visibleDevices.map((device) => {
              const isSelected = selectedDeviceId === device.id
              const statusLabel =
                device.status === 'online' ? translate('online') : device.status === 'enrolling' ? translate('needsPairing') : device.status
              const isRefreshing = commandFeedback?.device_id === device.id && commandFeedback.phase === 'submitting'

              return (
                <Block
                  aria-label={`${device.name}, ${statusLabel}`}
                  className="device-card"
                  data-selected={isSelected || undefined}
                  key={device.id}
                  shadow={isSelected}
                  variant="outlined"
                >
                  <button className="preview-select" onClick={() => selectDevice(device)} type="button">
                    <DevicePreview
                      title={device.active_page_id}
                      previewSvg={previewSvgByDevice[device.id] ?? device.preview_svg}
                      isSelected={selectedPreviewId === device.id}
                    />
                  </button>

                  <Flexbox className="device-meta" gap={16}>
                    <Flexbox horizontal align="center" justify="space-between" gap={12} wrap="wrap">
                      <Flexbox horizontal align="center" gap={8}>
                        <Tag
                          color={statusColor(device.status)}
                          icon={device.status === 'online' ? <Wifi aria-hidden size={14} /> : <CircleAlert aria-hidden size={14} />}
                        >
                          {statusLabel}
                        </Tag>
                        <Text className="page-id" type="secondary">
                          {device.active_page_id}
                        </Text>
                      </Flexbox>
                      <Text className="device-id" type="secondary">
                        {device.id}
                      </Text>
                    </Flexbox>
                    <Flexbox gap={4}>
                      <h3>{device.name}</h3>
                      <Text type="secondary">{device.firmware_version ?? translate('firmwarePending')}</Text>
                    </Flexbox>
                    <UsageMeter values={device.source_values} translate={translate} />
                    <Flexbox className="device-power" horizontal align="center" gap={8}>
                      <BatteryMedium aria-hidden size={17} />
                      <Text type="secondary">
                        {device.battery_percent !== null
                          ? translate('batteryStatus', { percent: device.battery_percent })
                          : translate('batteryUnavailable')}
                      </Text>
                    </Flexbox>
                    <Flexbox className="device-actions" horizontal gap={10} wrap="wrap">
                      <Button icon={ChevronRight} iconPosition="end" onClick={() => selectDevice(device)} size="large" type="primary">
                        {translate('openDevice')}
                      </Button>
                      <Tooltip title={translate('refreshPreview')}>
                        <Button
                          aria-label={translate('refreshPreview')}
                          icon={RefreshCw}
                          loading={isRefreshing}
                          onClick={() => refreshPreview(device)}
                          size="large"
                        />
                      </Tooltip>
                    </Flexbox>
                  </Flexbox>
                </Block>
              )
            })}
          </Flexbox>
        )}
      </section>

      {selectedDeviceId && (
        <section aria-labelledby="page-control-heading" className="page-control-section">
          <Flexbox gap={4}>
            <h2 id="page-control-heading">{translate('pageControl')}</h2>
            <Text type="secondary">{translate('pageControlDescription')}</Text>
          </Flexbox>
          {pageLoading ? (
            <Text>{translate('pagesLoading')}</Text>
          ) : pageConfiguration ? (
            <Block className="page-control-card" variant="outlined">
              <Flexbox className="page-state" horizontal gap={12} wrap="wrap">
                <Tag>{translate('confirmedPage', { page: pageConfiguration.active_page_id })}</Tag>
                <Tag color={pageConfiguration.active_page_id === pageConfiguration.desired_page_id ? 'green' : 'gold'}>
                  {translate('targetPage', { page: pageConfiguration.desired_page_id })}
                </Tag>
                <Text type="secondary">{translate('pageCount', { count: pageConfiguration.enabled_page_ids.length })}</Text>
              </Flexbox>
              <Flexbox className="page-options" gap={8}>
                {pageConfiguration.available_pages.map((page) => {
                  const enabled = pageConfiguration.enabled_page_ids.includes(page.page_id)
                  const index = pageConfiguration.enabled_page_ids.indexOf(page.page_id)
                  return (
                    <Flexbox className="page-option" horizontal align="center" justify="space-between" key={page.page_id} gap={12}>
                      <Checkbox
                        checked={enabled}
                        disabled={!enabled && pageConfiguration.enabled_page_ids.length >= 10}
                        onChange={(checked) => togglePage(page.page_id, checked)}
                      >
                        {page.page_id}
                      </Checkbox>
                      <Flexbox horizontal gap={6}>
                        <Button
                          aria-label={translate('movePageUp', { page: page.page_id })}
                          disabled={!enabled || index === 0}
                          icon={ArrowUp}
                          onClick={() => movePage(page.page_id, -1)}
                          size="large"
                        />
                        <Button
                          aria-label={translate('movePageDown', { page: page.page_id })}
                          disabled={!enabled || index === pageConfiguration.enabled_page_ids.length - 1}
                          icon={ArrowDown}
                          onClick={() => movePage(page.page_id, 1)}
                          size="large"
                        />
                        <Button
                          disabled={!enabled}
                          onClick={() => setPageConfiguration({ ...pageConfiguration, desired_page_id: page.page_id })}
                          size="large"
                          type={pageConfiguration.desired_page_id === page.page_id ? 'primary' : 'default'}
                        >
                          {translate('showPage')}
                        </Button>
                      </Flexbox>
                    </Flexbox>
                  )
                })}
              </Flexbox>
              <Button disabled={pageSaving} loading={pageSaving} onClick={savePages} size="large" type="primary">
                {translate('savePages')}
              </Button>
            </Block>
          ) : (
            <Text type="secondary">{translate('pagesUnavailable')}</Text>
          )}
        </section>
      )}

      {commandFeedback && (
        <Alert
          aria-live="polite"
          className="live-feedback"
          closable
          closeText={translate('closeNotice')}
          message={commandFeedback.message || translate('refreshPreview')}
          onClose={() => setCommandFeedback(null)}
          showIcon
          type={commandFeedback.phase === 'error' ? 'error' : commandFeedback.phase === 'accepted' ? 'success' : 'info'}
        />
      )}
      <EnrollmentDialog open={enrollmentOpen} onClose={() => setEnrollmentOpen(false)} />
    </main>
  )
}

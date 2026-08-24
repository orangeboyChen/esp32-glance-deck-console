'use client'

import { Flexbox, Input, Modal, Text, toast } from '@lobehub/ui'
import { Button } from '@lobehub/ui/base-ui'
import { useAtom } from 'jotai'
import { useTranslations } from 'next-intl'
import type { FormEvent } from 'react'
import {
  enrollmentErrorAtom,
  enrollmentNameAtom,
  enrollmentPairingCodeAtom,
  enrollmentSubmittingAtom,
} from '@/app/_components/dashboard/enrollment-state'
import { useRouter } from '@/i18n/navigation'
import { Api } from '@/lib/api-client'

type EnrollmentDialogProps = {
  open: boolean
  onClose: () => void
}

export const EnrollmentDialog = ({ open, onClose }: EnrollmentDialogProps) => {
  const translate = useTranslations('Dashboard')
  const router = useRouter()
  const [name, setName] = useAtom(enrollmentNameAtom)
  const [pairingCode, setPairingCode] = useAtom(enrollmentPairingCodeAtom)
  const [submitting, setSubmitting] = useAtom(enrollmentSubmittingAtom)
  const [error, setError] = useAtom(enrollmentErrorAtom)

  const close = () => {
    if (submitting) {
      return
    }
    setError(null)
    setName('')
    setPairingCode('')
    onClose()
  }

  const finish = () => {
    setError(null)
    setName('')
    setPairingCode('')
    onClose()
  }

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      const response = await Api.enrollDevice({ name: name.trim(), pairing_code: pairingCode, board_model: 'ESP32-S3-RLCD-4.2' })
      toast.success(translate('deviceAdded', { id: response.device_id }))
      finish()
      router.refresh()
    } catch (submissionError) {
      const reason = submissionError instanceof Error ? submissionError.message : 'enrollment_failed'
      setError(translate.has(reason) ? translate(reason) : translate('enrollmentFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      destroyOnHidden
      footer={
        <Flexbox horizontal justify="flex-end" gap={8}>
          <Button disabled={submitting} onClick={close} size="large">
            {translate('cancel')}
          </Button>
          <Button form="enrollment-form" htmlType="submit" loading={submitting} size="large" type="primary">
            {translate('pairDevice')}
          </Button>
        </Flexbox>
      }
      open={open}
      title={translate('addDeviceTitle')}
      width={480}
      onCancel={close}
    >
      <form className="enrollment-form" id="enrollment-form" onSubmit={submit}>
        <Text type="secondary">{translate('addDeviceDescription')}</Text>
        <label htmlFor="device-name">{translate('deviceName')}</label>
        <Input
          id="device-name"
          maxLength={128}
          placeholder={translate('deviceNamePlaceholder')}
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <label htmlFor="pairing-code">{translate('pairingCode')}</label>
        <Input
          id="pairing-code"
          inputMode="numeric"
          maxLength={6}
          pattern="[0-9]{6}"
          placeholder={translate('pairingCodePlaceholder')}
          required
          value={pairingCode}
          onChange={(event) => setPairingCode(event.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
        />
        <Text type="secondary">{translate('pairingCodeHelp')}</Text>
        {error && (
          <Text className="enrollment-error" type="danger">
            {error}
          </Text>
        )}
      </form>
    </Modal>
  )
}

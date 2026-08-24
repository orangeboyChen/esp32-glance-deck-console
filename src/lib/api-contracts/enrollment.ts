export type EnrollmentAnnounceRequest = {
  pairing_code: string
  claim_secret: string
  board_model: 'ESP32-S3-RLCD-4.2'
}
export type EnrollmentAnnounceResponse = { expires_at: string; status: 'pending' | 'approved' }
export type EnrollmentClaimRequest = { pairing_code: string; claim_secret: string }
export type EnrollmentClaimResponse =
  { status: 'pending' } | { status: 'claimed'; device_id: string; mqtt: { broker_url: string; username: string; password: string } }

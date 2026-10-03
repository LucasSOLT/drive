# DRiVE — TODO / Reminders

## 🔔 Week of Aug 17, 2026

### Custom SMTP for Branded Emails
**Priority**: Medium  
**Why**: Verification emails currently say "from Supabase" instead of "from DRiVE Team"  
**What to do**:
1. Sign up for [Resend](https://resend.com) (free tier: 100 emails/day) or [Brevo](https://brevo.com) (free: 300/day)
2. Get SMTP credentials (host, port, username, password)
3. Go to **Supabase Dashboard → Authentication → Email Templates → SMTP Settings**
4. Enter SMTP credentials + set sender name to "DRiVE Team" and sender email to your support email
5. Customize the email subject lines and HTML templates to match DRiVE branding

### Stripe Identity Verification
**Priority**: High (blocks real payouts)  
**Why**: Stripe won't send you money until business identity is verified  
**What to do**:
1. Get EIN from business owner
2. Complete Stripe **Settings → Business details** verification
3. Add bank account for payouts

---

## ⛔ STRICT PRODUCT RULES (DO NOT VIOLATE)
- **NO In-App AI Image Generation**: Never implement in-app AI image/video generation. Users must create their artwork externally and upload it. Upload-only workflow for all media.

---

## Backlog
- [ ] Stripe Customer Portal (manage/cancel subscriptions)
- [ ] Community Moderation & Curator Dashboard Polish
- [ ] Idempotency checks on Stripe webhook
- [ ] Terms of Service & Privacy Policy pages
- [ ] Apple Pay domain verification
- [ ] Enable Google Pay in Stripe dashboard

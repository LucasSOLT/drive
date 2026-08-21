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

## Backlog
- [ ] Real AI generation (OpenRouter integration)
- [ ] Stripe Customer Portal (manage/cancel subscriptions)
- [ ] User story publishing & admin feed
- [ ] Idempotency checks on Stripe webhook
- [ ] Terms of Service & Privacy Policy pages
- [ ] Apple Pay domain verification
- [ ] Enable Google Pay in Stripe dashboard

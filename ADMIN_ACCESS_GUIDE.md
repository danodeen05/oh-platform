# Admin Dashboard Access Guide

## Production URLs

### Admin Dashboard Homepage
```
https://ohbeef.com/admin
```

This is the landing page showing two main sections:
- 👨‍🍳 Kitchen Display
- 🧹 Cleaning Management

### Kitchen Display
```
https://ohbeef.com/admin/kitchen
```

**Features:**
- View all active orders in real-time
- Four columns: QUEUED → PREPPING → READY → SERVING
- Average Order Processing Time (top right)
  - 🟢 Green: < 4 minutes
  - 🟠 Orange: 4-7 minutes
  - 🔴 Red: 7+ minutes
- Location filter dropdown
- Order age tracking with color coding
- Status update buttons for each order
- Auto-refreshes every 10 seconds

**Staff Workflow:**
1. Order appears in QUEUED column
2. Click "Start Preparing" → moves to PREPPING
3. Click "Mark Ready" → moves to READY
4. Click "Deliver to Pod" → moves to SERVING
5. Order stays in SERVING until customer clicks "I'm Done Eating" or staff marks complete

### Cleaning Management (Pod Manager)
```
https://ohbeef.com/admin/pods
```

**Features:**
- View all pods in three columns: OCCUPIED → CLEANING → AVAILABLE
- Average Cleaning Time (top right)
  - 🟢 Green: < 3 minutes
  - 🟠 Orange: 3-5 minutes
  - 🔴 Red: 5+ minutes
- Location filter dropdown
- Pod status counts at top
- Time in pod tracker (color-coded)
  - White: < 15 minutes
  - Orange: 15-20 minutes
  - Red: 20+ minutes
- Auto-refreshes every 5 seconds

**Staff Workflow:**
1. Pod shows in OCCUPIED when customer checks in
2. Shows order status (Queued, Preparing, Ready, Serving)
3. When customer clicks "I'm Done Eating" → button appears: "Customer Left - Start Cleaning"
4. Click button → pod moves to CLEANING column
5. Click "✓ Cleaning Complete" → pod moves to AVAILABLE

## Development URLs

If you want to test locally first:

### Admin Dashboard
```
http://localhost:3001/admin
```

### Kitchen Display
```
http://localhost:3001/admin/kitchen
```

### Cleaning Management
```
http://localhost:3001/admin/pods
```

## Admin App Port

The admin app runs on port **3001** in development:
- Main web app: `http://localhost:3000` (customer-facing)
- Admin app: `http://localhost:3001` (staff-facing)
- API: `http://localhost:4001`

## Authentication

The admin dashboard uses the same Clerk authentication as the main app. Make sure you're signed in to access the admin interface.

## Testing the Full Flow in Production

1. **Place an order** (as customer):
   - Go to `https://ohbeef.com`
   - Sign in
   - Place an order for ASAP or schedule a time

2. **View in Kitchen Display**:
   - Go to `https://ohbeef.com/admin/kitchen`
   - See your order appear in QUEUED column
   - Progress it through: PREPPING → READY → SERVING

3. **Check Pod Status** (as customer):
   - Customer receives order QR code
   - At restaurant, scans QR code at kiosk
   - Gets assigned to a pod
   - Goes to `https://ohbeef.com/order/status?orderQrCode=ORDER-...`
   - Sees real-time status updates

4. **View in Cleaning Management**:
   - Go to `https://ohbeef.com/admin/pods`
   - See pod in OCCUPIED column with order status
   - See time tracker counting up

5. **Customer finishes eating**:
   - Customer clicks "I'm Done Eating" on status page
   - Pod moves to CLEANING in admin view

6. **Clean the pod**:
   - Staff clicks "✓ Cleaning Complete"
   - Pod moves to AVAILABLE
   - Average cleaning time updates

## Performance Metrics

Both admin views show real-time performance metrics at the top:

### Kitchen Display
- **Average Order Processing Time**: Time from order QUEUED to SERVING
- Calculated for today only
- Filters by selected location
- Shows count of orders included in average

### Cleaning Management
- **Average Cleaning Time**: Time from order COMPLETED to pod AVAILABLE
- Calculated for today only
- Filters by selected location
- Shows count of completed cleanings

## Troubleshooting

### Can't access admin dashboard
- Make sure you're signed in with Clerk
- Check that the URL is correct (`/admin` not `/admin/`)
- Clear browser cache and try again

### Orders not appearing
- Check that you've selected the correct location in the dropdown
- Verify API is running (should be automatic in production)
- Check browser console for errors

### Metrics showing --:--
- This means no data for today yet
- Create and complete some orders to populate metrics
- Metrics reset daily at midnight

### Pod not changing status
- Make sure you're clicking the correct button
- Check that the API endpoint is responding
- Try refreshing the page

## Browser Compatibility

Tested and working on:
- Chrome/Edge (recommended)
- Firefox
- Safari

For best experience, use a modern browser with JavaScript enabled.

## Mobile Considerations

While the admin dashboard can be accessed on mobile devices, it's optimized for desktop/tablet screens. Kitchen and cleaning staff should use devices with at least 1024px width for optimal viewing.

## Support

If you encounter any issues:
1. Check browser console for errors (F12)
2. Verify you're on the latest deployment
3. Try hard refresh (Cmd+Shift+R on Mac, Ctrl+Shift+R on Windows)
4. Document the error and steps to reproduce

---

**Last Updated**: December 9, 2025
**Version**: Production v1.0

# Brand Account Settings & Features

## Overview
Enhanced brand account management system with comprehensive settings and social features.

## Database Structure

### New Tables Created

#### 1. `brands` Table
Main table for brand profiles with:
- **Basic Info**: brand_name, tagline, description, logo_url
- **Business Details**: website, category, country, manager_name
- **Contact Info**: email, phone, address
- **Social Media**: instagram, twitter, facebook, linkedin, tiktok, youtube
- **Privacy Settings**: is_public, allow_messages, allow_product_requests, auto_approve_followers
- **Notifications**: notify_new_follower, notify_product_mention, notify_review
- **Analytics**: show_analytics_publicly
- **Business**: return_policy, business_hours, shipping_countries

#### 2. `brand_followers` Table
Tracks users/brands following a brand:
- brand_id → follower_id relationship
- follower_type: 'user' or 'brand'
- status: 'pending', 'accepted', 'blocked'

#### 3. `brand_following` Table
Tracks brands following users/other brands:
- brand_id → following_id relationship
- following_type: 'user' or 'brand'
- status: 'pending', 'accepted', 'blocked'

#### 4. `brand_settings_history` Table
Audit trail for settings changes:
- Logs who changed what and when
- Tracks critical settings like privacy, messaging, auto-approve

## Features

### ✅ Social Networking
**YES** - Brands can:
- Follow regular users
- Follow other brands
- Be followed by users
- Be followed by other brands
- Auto-approve followers or manually approve
- Block unwanted followers

### 🔒 Privacy & Interaction Controls
- **Public Profile**: Toggle brand visibility
- **Allow Messages**: Control direct messaging
- **Allow Product Requests**: Let users request unlisted products
- **Auto-Approve Followers**: Automatic vs manual approval

### 🔔 Notification Preferences
- **New Followers**: Get notified when someone follows
- **Product Mentions**: When products are added to wishlists
- **Reviews & Feedback**: Customer review notifications

### 📊 Analytics Settings
- **Public Analytics**: Choose to display stats publicly
- Track follower growth
- Monitor product mentions
- View engagement metrics

### 🌐 Extended Social Media
Now supports:
- Instagram
- Twitter/X
- Facebook
- LinkedIn
- **TikTok** (new)
- **YouTube** (new)

### 💼 Business Settings
- **Return Policy**: Detailed return/refund information
- **Business Hours**: Operating hours (JSONB format)
- **Shipping Countries**: Array of supported countries

## Settings Sections in UI

### 1. Brand Logo
- Upload/change brand logo
- Stored in Supabase Storage

### 2. Basic Information
- Brand name, tagline, description
- Category, country, manager name

### 3. Contact & Links
- Website, email, phone, address
- All contact methods in one place

### 4. Social Media
- All 6 social platforms
- Direct links to brand profiles

### 5. Business Settings
- Return policy
- Business operational details

### 6. Privacy & Interaction
- Message controls
- Product request settings
- Follower approval settings

### 7. Notifications
- Granular notification controls
- Choose what alerts to receive

### 8. Analytics & Insights
- Public stats visibility
- Performance tracking preferences

### 9. Visibility Settings
- Master public/private toggle
- Profile discoverability

## Security Features

### Row Level Security (RLS)
- Public brands visible to all authenticated users
- Private brands only visible to owner
- Brand owners have full CRUD on their profile
- Followers/following have appropriate visibility rules

### Audit Trail
- All critical settings changes logged
- Tracks who made changes and when
- Immutable history for compliance

### Realtime Updates
- Follower changes broadcast in realtime
- Following updates pushed to clients
- Live notification system

## Migration File
`20251130000000_create_brands_table_and_settings.sql`

Includes:
- Table creation
- RLS policies
- Indexes for performance
- Triggers for auto-updates
- Realtime configuration

## UI Components Updated

### BrandProfile.tsx
- Comprehensive settings interface
- All new fields integrated
- Beautiful gradient cards
- Organized sections with icons
- Responsive design

### BrandLayout.tsx
- Fixed bottom navigation
- Matches MainLayout design
- Gradient border and text effects
- Touch-optimized for mobile

## Next Steps

1. **Run Migration**: Apply the SQL migration to create tables
2. **Test Settings**: Verify all toggles and inputs work
3. **Implement Following**: Build UI for managing followers/following
4. **Analytics Dashboard**: Create insights page using settings
5. **Notification System**: Wire up notification preferences

## Benefits

✅ **Complete Control**: Brands manage all aspects of their presence
✅ **Social Discovery**: Network with users and other brands
✅ **Privacy First**: Granular control over interactions
✅ **Professional**: Comprehensive business information
✅ **Scalable**: Ready for advanced features
✅ **Compliant**: Audit trail for business requirements

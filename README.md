# ProcureWise Suite

Build a complete production-ready procurement management portal called easybidding from START to END.

IMPORTANT:
This must be one connected system.

Do not use dummy data for actual workflows.
Use the backend/database as the source of truth.
All authentication, approvals, users, departments, items, vendors, purchases, vendor assignments, quotations, comparisons, notifications, and status tracking must be connected to the backend.

Do not break existing functionality when adding new features.

==================================================
1. APPLICATION BRANDING
==================================================

Application name:

easybidding

Subtitle:

Secure procurement

Use a professional procurement portal design.

Visual style:

- Dark navy/black background
- Dark blue sidebar/cards
- Gold accent
- White/light text
- Rounded cards
- Professional industrial procurement appearance

==================================================
2. MAIN HEADER
==================================================

Create a full-width top header.

LEFT:

Easybidding logo

Secure procurement badge

CENTER:

Development connection indicator when running in development.

RIGHT:

Logged-in user name

Print / Save PDF where applicable

Sign in when logged out

Sign out when logged in

==================================================
3. LOGIN PAGE
==================================================

The login page must look like the approved reference design.

LEFT:

Portal Access sidebar:

Dashboard
Purchase
Items
Quotations
Comparison
Status

RIGHT:

Secure Account Access card.

Title:

SECURE ACCOUNT ACCESS

Welcome to easybidding

Description:

“Sign in with your approved work-email login ID. First-time authorized administrators must request access, verify the six-digit email code, then sign in.”

Buttons:

Sign in
Email link
Request access
Reset password

USER ID (EMAIL)

Input:

you@company.com

PASSWORD

Password input with show/hide icon.

Main button:

Sign in

Below:

Connect with Google

Below:

Forgot your password?

Keep the design responsive.

==================================================
4. AUTHENTICATION
==================================================

Support:

- Email/password login
- Google login
- Email verification
- Six-digit verification code where required
- Password reset
- Sign out

Authentication must be handled securely by the backend.

Do not trust frontend/localStorage alone.

==================================================
5. GOOGLE LOGIN + ACCOUNT APPROVAL
==================================================

Workflow:

Connect with Google
↓
Google authentication
↓
Get Google user ID
↓
Get email
↓
Get display name
↓
Check user record
↓
Check approval record

NEW USER:

Create user
↓
Create approval request
↓
status = Pending
↓
Do NOT allow portal access

Show:

“Your account access request has been submitted successfully. Please wait for Super Admin approval.”

EXISTING USER:

Pending:
Show waiting-for-approval message.

Approved:
Allow portal access.

Rejected:
Deny access.

Correction Required:
Show correction message.

Disabled:
Deny access.

Never create duplicate Pending approval requests.

==================================================
6. ACCOUNT APPROVAL DATABASE
==================================================

Use:

account_approval_requests

IMPORTANT:

Use the actual database schema.

Allowed fields:

approved_by
approved_date
correction_message
displayName
email
id
isActive
last_updated
rejected_by
rejected_date
rejection_reason
status
userId

DO NOT send:

department
googleId
lastUpdated
requestedRole
userName
request_date

Correct mappings:

userName → displayName

googleId → userId

lastUpdated → last_updated

request_date → last_updated

New request example:

userId
displayName
email
status = Pending
isActive = true
last_updated = current timestamp

==================================================
7. SUPER ADMIN
==================================================

Create Super Admin role.

Super Admin has full system visibility/control.

Sidebar:

Admin Panel
Approvals
Users
Item Master
Vendor Master
Vendor Quotations
Comparison Dashboard
Purchase
Departments
Audit Log
Settings

==================================================
8. APPROVAL PAGE
==================================================

Super Admin → Approvals

Show:

Account Approvals

Pending Login Approvals

Notification:

🔔 X New Approval Requests

Read from:

account_approval_requests

Filter:

status = Pending

Sort:

last_updated DESC

Show:

Display Name
Email
User ID
Status
Last Updated

Actions:

APPROVE
REJECT
REQUEST CORRECTION

APPROVE:

status = Approved
approved_date = current timestamp
approved_by = Super Admin ID
last_updated = current timestamp

REJECT:

status = Rejected
rejection_reason = entered reason
rejected_date = current timestamp
rejected_by = Super Admin ID
last_updated = current timestamp

REQUEST CORRECTION:

status = Correction Required
correction_message = entered message
last_updated = current timestamp

Keep completed decisions visible for audit.

==================================================
9. USER MANAGEMENT
==================================================

Super Admin → Users

Show:

User Name
User ID
Email
Role
Status
Last Login
Reset Password
Manage

Super Admin can:

- Create internal user
- Approve user
- Disable user
- Assign role
- Reset password
- Manage access

Existing approved users must remain approved.

==================================================
10. DEPARTMENTS
==================================================

Create department management.

Initial departments:

IT
GUDIBOX
SPARES
CONSUMABLES

The system must support adding more departments later.

Super Admin can:

- Add department
- Edit department
- Disable department
- View department

Do not hard-code the system so that only these four departments can ever exist.

==================================================
11. VENDOR MASTER
==================================================

Create/use Vendor Master.

Fields:

Vendor ID
Vendor Name
Contact Person
Mobile
Email
Address
GST
PAN
Scope of Supply
Designation
Sales Manager
Status

Super Admin/Purchase can manage vendors.

Vendor accounts must be linked to the correct vendor ID.

==================================================
12. VENDOR LOGIN
==================================================

After vendor login:

Authenticate user
↓
Check approval
↓
Find vendor account
↓
Check vendor status
↓
Load only that vendor's authorized data

Vendor must NEVER see another vendor's requirements or quotations.

Backend must enforce this.

==================================================
13. ITEM MASTER
==================================================

Create/use Item Master.

Fields:

Item ID
Item Code
Item Name
Description
Specification
Unit
Category
Status

Items must be linked by ID, not only by name.

==================================================
14. PURCHASE MATERIAL UPLOAD
==================================================

Purchase can upload material/item requirements.

The upload can be Excel.

Excel columns can include:

Department
Item Code
Item Name
Description
Specification
Quantity
Unit
Required Date
Vendor

Example:

IT | IT-001 | Keyboard | 20 | ABC Technologies

SPARES | SP-001 | Bearing 6205 | 500 | XYZ Bearings

CONSUMABLES | CO-001 | Welding Rod | 1000 | PQR Welding

GUDIBOX | GU-001 | Gudi Box Item | 50 | ABC Suppliers

When uploaded:

Each row must retain:

Department
Item
Quantity
Vendor assignment

==================================================
15. DEPARTMENT-WISE PURCHASE
==================================================

Purchase requirements must be organized primarily by DEPARTMENT.

Departments:

IT
GUDIBOX
SPARES
CONSUMABLES

Purchase should be able to select:

Department
↓
Upload/Add Items
↓
Select Vendor
↓
Save

Do not mix all department requirements together by default.

Provide department filtering/navigation.

==================================================
16. VENDOR-SPECIFIC ITEM ASSIGNMENT
==================================================

THIS IS CRITICAL.

When Purchase uploads/creates an item, it must be assigned to a specific vendor.

Example:

Department:
SPARES

Item:
Bearing 6205

Quantity:
500

Vendor:
ABC Bearings

After saving:

ABC Bearings → sees Bearing 6205.

All other vendors → do NOT see Bearing 6205.

The item must NOT automatically go to all vendors.

Vendor assignment must be stored in the backend/database.

Use existing:

Item Master
+
Vendor Master

with proper IDs.

Conceptually:

item_id → Item Master

vendor_id → Vendor Master

==================================================
17. VENDOR SECURITY
==================================================

Vendor A:

Can see only Vendor A's assigned requirements.

Vendor B:

Can see only Vendor B's assigned requirements.

Vendor A must NOT be able to access Vendor B's data by changing:

- URL
- Item ID
- Vendor ID
- API request
- Frontend filter

Backend must verify vendor ownership.

Do NOT load all vendor data into the browser and hide it with JavaScript.

==================================================
18. PURCHASE DASHBOARD
==================================================

Show department-wise information.

Example:

IT
Total Items
Pending
Vendor Assigned
Quotation Received

GUDIBOX
Total Items
Pending
Vendor Assigned
Quotation Received

SPARES
Total Items
Pending
Vendor Assigned
Quotation Received

CONSUMABLES
Total Items
Pending
Vendor Assigned
Quotation Received

All numbers must come from the real database.

==================================================
19. PURCHASE FILTERS
==================================================

Purchase module must support:

Department
Vendor
Item
Status
Date
Quotation Status

Department options:

All Departments
IT
GUDIBOX
SPARES
CONSUMABLES
+ future departments

Filters must work together using AND logic.

==================================================
20. VENDOR DASHBOARD
==================================================

Vendor dashboard must show only assigned requirements.

Example:

ABC Technologies:

IT
- Keyboard
- Mouse

SPARES:
- Only if assigned

XYZ Bearings:

SPARES
- Bearing 6205

ABC Technologies must NOT see XYZ Bearings' Bearing 6205.

==================================================
21. VENDOR QUOTATION
==================================================

Create Vendor Quotations.

Quotation fields:

Item
Item Code
Quantity
Vendor
Offer Number
Offer Date
Rate
Total
Delivery Terms
Payment Terms
Contact Person
Contact Number
Status
Review Flag
Attachment

Quotation must retain:

Department
Item ID
Vendor ID

==================================================
22. QUOTATION WORKFLOW
==================================================

Purchase:

Upload requirement
↓
Select Department
↓
Select Vendor
↓
Save
↓
Vendor receives assigned item
↓
Vendor logs in
↓
Vendor sees item
↓
Vendor submits quotation
↓
Purchase/Super Admin receives quotation
↓
Comparison
↓
Approval
↓
Status update

==================================================
23. VENDOR QUOTATION FILTERING
==================================================

Vendor Quotations page must support:

Search
Item Code
Offer Date
Quotation Status
Vendor
Review Flag

Search across:

Item Name
Item Code
Vendor Name
Offer Number

Status:

All
Draft
Submitted
Under Review
Approved
Rejected
Pending

Review:

All
Review Required
No Review Required

Multiple filters must work together.

Example:

Vendor = ABC Bearings
+
Status = Approved
+
Item Code = BRG-6205

Show only matching records.

Do not break or remove existing quotation filters.

==================================================
24. QUOTATION SECURITY
==================================================

Vendor can only access their own quotations.

Backend must verify:

authenticated vendor ID
=
quotation vendor ID

==================================================
25. QUOTATION DEPARTMENT
==================================================

Every quotation must retain the department of the original Purchase requirement.

Example:

Department:
SPARES

Item:
Bearing 6205

Vendor:
XYZ Bearings

Quotation:
QTN-001

The quotation remains linked to:

SPARES
+
Bearing 6205
+
XYZ Bearings

This allows department-wise quotation filtering.

==================================================
26. COMPARISON DASHBOARD
==================================================

Create Comparison Dashboard.

Compare vendor quotations by:

Department
Item
Vendor
Rate
Total
Delivery Terms
Payment Terms
Offer Number
Offer Date
Status

Allow department filtering.

Example:

Department = SPARES

→ Show only SPARES quotations.

Department = IT

→ Show only IT quotations.

==================================================
27. PURCHASE STATUS
==================================================

Track:

Pending
Vendor Assigned
Quotation Requested
Quotation Received
Under Review
Comparison Completed
Approved
Rejected
Completed

Show current status.

==================================================
28. NOTIFICATIONS
==================================================

When Purchase assigns an item:

Vendor receives:

“You have received a new material requirement.”

When Vendor submits quotation:

Purchase/Super Admin receives notification.

When Super Admin approves account:

User can log in.

==================================================
29. AUDIT LOG
==================================================

Track:

User Created
Login
Approval Requested
User Approved
User Rejected
Vendor Created
Item Uploaded
Vendor Assigned
Quotation Submitted
Quotation Approved
Quotation Rejected
Status Changed

Store:

User
Action
Date/Time
Record ID
Status

==================================================
30. ROLE-BASED ACCESS
==================================================

Roles:

SUPER ADMIN
PURCHASE
VENDOR

SUPER ADMIN:

Full access.

PURCHASE:

Purchase
Items
Vendors
Quotations
Comparison
Status

VENDOR:

Assigned Items
Own Quotations
Own Status
Own Notifications

Vendor cannot access other vendor data.

==================================================
31. DATABASE SECURITY
==================================================

Backend/database is the source of truth.

Do not rely on:

localStorage
sessionStorage
frontend-only permissions
hidden buttons
frontend-only filtering

Every API request must verify:

Authentication
+
Role
+
User ID
+
Vendor ID where applicable

==================================================
32. DUPLICATE PREVENTION
==================================================

Prevent:

Duplicate users
Duplicate approval requests
Duplicate vendors
Duplicate item records
Duplicate vendor assignments
Duplicate quotations

Use proper IDs and relationships.

==================================================
33. ERROR HANDLING
==================================================

Provide clear backend logging:

[AUTH]
[USER]
[APPROVAL]
[DEPARTMENT]
[VENDOR]
[ITEM]
[PURCHASE]
[QUOTATION]
[COMPARISON]

Do not hide database errors behind generic messages.

==================================================
34. LIVE DEPLOYMENT
==================================================

The live website must use the latest production build.

Development and live must show the same latest version.

Deployment:

Development
↓
Production Build
↓
Deploy
↓
Live Domain
↓
Verify

Clear/invalidate cache if required.

Make sure live uses the correct backend/database/API.

==================================================
35. FINAL END-TO-END TEST
==================================================

TEST 1:

New Google user

Google Login
↓
Pending approval
↓
Super Admin sees request
↓
Approve
↓
User logs in
↓
Portal access granted

TEST 2:

Purchase uploads:

Department = SPARES

Item = Bearing 6205

Quantity = 500

Vendor = ABC Bearings

Result:

ABC Bearings → sees Bearing 6205

XYZ Bearings → does NOT see Bearing 6205

Purchase → sees it under SPARES

Super Admin → sees everything

TEST 3:

Purchase uploads:

Department = IT

Item = Keyboard

Vendor = XYZ Technologies

Result:

XYZ Technologies → sees Keyboard

ABC Bearings → does NOT see Keyboard

TEST 4:

Vendor submits quotation.

Quotation retains:

Department
Item
Vendor
Offer Number
Offer Date
Rate
Delivery Terms
Payment Terms
Contact Person
Contact Number

Purchase sees quotation.

Super Admin sees quotation.

Comparison Dashboard shows quotation.

TEST 5:

Vendor quotation filters:

Vendor filter
+
Item Code
+
Status
+
Department

All filters work together.

==================================================
36. MOST IMPORTANT RULE
==================================================

DO NOT BREAK EXISTING FEATURES.

When adding anything new:

DO NOT redesign existing pages.

DO NOT change working authentication.

DO NOT change Google approval workflow unless fixing an actual error.

DO NOT unnecessarily change existing database fields.

DO NOT create duplicate Item Master.

DO NOT create duplicate Vendor Master.

DO NOT create duplicate quotation systems.

DO NOT remove existing buttons.

DO NOT remove existing filters.

DO NOT remove existing data.

Use the existing working system and ADD the required functionality.

==================================================
37. FINAL SYSTEM
==================================================

The completed easybidding portal must contain:

LOGIN
+
GOOGLE AUTHENTICATION
+
ACCOUNT APPROVAL
+
SUPER ADMIN
+
USER MANAGEMENT
+
DEPARTMENTS
+
ITEM MASTER
+
VENDOR MASTER
+
PURCHASE
+
EXCEL MATERIAL UPLOAD
+
DEPARTMENT-WISE PURCHASE
+
VENDOR-SPECIFIC ITEM ASSIGNMENT
+
VENDOR LOGIN
+
VENDOR-SPECIFIC ITEM VISIBILITY
+
VENDOR QUOTATIONS
+
QUOTATION FILTERING
+
DEPARTMENT-WISE QUOTATIONS
+
COMPARISON DASHBOARD
+
STATUS TRACKING
+
NOTIFICATIONS
+
AUDIT LOG
+
ROLE-BASED SECURITY
+
LIVE DEPLOYMENT

Complete data flow:

USER
↓
AUTHENTICATION
↓
ACCOUNT APPROVAL
↓
PURCHASE
↓
DEPARTMENT
↓
ITEM UPLOAD
↓
VENDOR ASSIGNMENT
↓
VENDOR
↓
QUOTATION
↓
COMPARISON
↓
APPROVAL
↓
STATUS
↓
AUDIT

The entire system must work from START to END using the real backend/database and must be tested end-to-end before being considered complete.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/aef85a46-71b8-45c6-8f3e-2907a2062543).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

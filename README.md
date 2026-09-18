# HOSTER 1280 - Multi-Tenant Web Hosting Control Panel
### Custom Self-Hosted cPanel Alternative Architecture & Technical Guide

---

## 📌 ১. ওভারভিউ ও প্রজেক্ট পরিচিতি (Project Overview)
**HOSTER 1280** হলো উবুন্টু/লিনাক্স ভিপিএস (Ubuntu 24.04 LTS) এবং লোকালহোস্ট উভয়ের জন্য তৈরি একটি সম্পূর্ণ নিজস্ব (Self-Hosted), লাইটওয়েট এবং আধুনিক মাল্টি-টেন্যান্ট ওয়েব হোস্টিং কন্ট্রোল প্যানেল (cPanel Alternative)।

- **মেইন কন্ট্রোল প্যানেল ডোমেইন:** `hoster1280.shop`
- **প্রোডাকশন ভিপিএস পাবলিক আইপি:** `208.72.218.129`
- **গিটহাব রিপোজিটরি:** `https://github.com/abbas1280-dev/cpanel-1.git` (Branch: `main`)
- **প্রজেক্টের মূল ফোল্ডার লোকেশন (এই ব্যাকআপ):** `F:\users\Pictures\Downloads\hosting`

---

## 🏗️ ২. সিস্টেম আর্কিটেকচার (Core System Architecture)

### ক. ডোমেইন ও ক্যানোনিকাল ফাইল পাথ (Canonical Webroot)
1. **প্রোডাকশন লিনাক্স পাথ:** 
   - প্রতিটি নতুন ডোমেইনের আসল ফাইল রুট হবে: `/var/www/vhosts/{domain}/public_html`
   - কনফিগারেশন ও ডাটা: `/var/www/vhosts/{domain}/etc/`
   - লগ ফাইল: `/var/www/vhosts/{domain}/logs/`
   - মেইল ও এফটিপি: `/var/www/vhosts/{domain}/mail/`, `/var/www/vhosts/{domain}/public_ftp/`
2. **টু-ওয়ে সিমলিঙ্ক ব্রিজ (Two-Way Symlink Bridge):**
   - ফাইল ম্যানেজারে ও কোডে পাথ যাতে কখনো মিসম্যাচ না হয়, সেজন্য স্বয়ংক্রিয়ভাবে সিমলিঙ্ক তৈরি থাকে:
     - `/home/{tenant_user}/public_html` ➔ `/var/www/vhosts/{domain}/public_html`
     - `server_storage/domains/{domain}` ➔ `/var/www/vhosts/{domain}`
   - ফলে cPanel ফাইল ম্যানেজার, SFTP কিংবা Nginx — যে যেখান থেকেই ফাইল দেখুক, সবাই সরাসরি `/var/www/vhosts/{domain}/public_html`-এর আসল ফাইলগুলোই পাবে।
3. **নিরাপত্তা ও স্যান্ডবক্সিং (Security Sandbox):**
   - ফাইল ম্যানেজার API-তে ডিরেক্টরি ট্রাভার্সাল (`../`) কঠোরভাবে ব্লক করা, ফলে কোনো ক্লায়েন্ট ডোমেইন রুট থেকে বের হয়ে সিস্টেম ফাইল এক্সেস করতে পারে না।

### খ. ওয়েব সার্ভার ও vHost অটোমেশন (Nginx & PHP-FPM)
- **ভার্চুয়াল হোস্ট কনফিগারেশন:** `/etc/nginx/sites-available/{domain}.conf`
- **লাইভ এনাবলড সিমলিঙ্ক:** `/etc/nginx/sites-enabled/{domain}.conf`
- **পিএইচপি সকেট:** প্রতিটি টেন্যান্টের জন্য ডেডিকেটেড ফাস্ট-সিজিআই সকেট (যেমন: `/run/php/php8.3-fpm-{tenant}.sock` অথবা সিস্টেমের সক্রিয় `php-fpm.sock`)।
- **জিরো-ডাউনটাইম রিলোড:** যেকোনো পরিবর্তনের পর `nginx -t` টেস্ট পাস করলেই কেবল `systemctl reload nginx` কার্যকর হয়।

### গ. অটো এসএসএল ইঞ্জিন (Let's Encrypt / Certbot & Snakeoil Fallback)
- ডোমেইন তৈরির সাথে সাথে পোর্ট ৪৪৩ সচল রাখতে সেলফ-সাইনড `ssl-cert-snakeoil.pem` কনফিগার করা হয়।
- ডিএনএস প্রোপাগেশন সক্রিয় হলে এক ক্লিকে Certbot Let's Encrypt প্রোডাকশন সার্টিফিকেট ইস্যু ও অটো-রিনিউয়াল কার্যকর হয়।

### ঘ. অথরিটেটিভ ডিএনএস ইঞ্জিন (Bind9 DNS Server)
- ভিপিএস নিজস্ব নেমসার্ভার (`ns1.hoster1280.shop`, `ns2.hoster1280.shop`) হ্যান্ডেল করার জন্য Bind9 ব্যবহার করে।
- `/etc/bind/named.conf.options`-এ `recursion no;` দিয়ে অথরিটেটিভ মোডে কনফিগার করা।
- প্রতিটি ডোমেইনের জোন ফাইল: `/etc/bind/db.{domain}`।

### ঙ. ডাটাবেজ ম্যানেজমেন্ট (MariaDB / MySQL & phpMyAdmin)
- প্রতিটি ডোমেইনের জন্য আলাদা আইসোলেটেড প্রিফিক্স (যেমন: `turkyhu1_db`, `turkyhu1_user`)।
- এক ক্লিকে টোকেন-বেসড phpMyAdmin SSO লগইন।

---

## 📂 ৩. কোন ফোল্ডার ও ফাইলে কী কাজ হয়েছে (File & Directory Breakdown)

```
hosting/
├── cpanel.html                         # cPanel Jupiter থিমের মূল ড্যাশবোর্ড ও ক্লায়েন্ট ইন্টারফেস
├── cpanel_production.html              # প্রোডাকশন বিল্ডের জন্য প্রস্তুতকৃত অপ্টিমাইজড cPanel HTML
├── cpanel_backend_server.js            # স্ট্যান্ডঅ্যালোন Node.js ব্যাকএন্ড সার্ভার (বিকল্প রানটাইম)
├── index.php                           # পিএইচপি ফাইল ম্যানেজার ও ডিরেক্টরি টেস্ট স্ক্রিপ্ট
├── package.json                        # প্রোজেক্ট ডিপেন্ডেন্সি ও বিল্ড স্ক্রিপ্ট (TypeScript, Vite, React, MariaDB)
├── vite.config.ts                      # Vite কনফিগারেশন এবং apiPlugin মিডলওয়্যার ইন্টিগ্রেশন
│
├── scripts/                            # লিনাক্স ভিপিএস অটোমেশন স্ক্রিপ্টসমূহ
│   ├── cpanel_full_system_sync.sh      # ★ মাস্টার সিস্টেম সিঙ্ক: /var/www/vhosts-এ ফাইল মাইগ্রেশন, Nginx, Bind9, PM2 রিলোড
│   ├── provision_tenant.sh             # ★ নতুন ডোমেইনের ফুল অটোমেটেড প্রোভিশনার (লিনাক্স ইউজার, ডক রুট, PHP-FPM, vHost)
│   ├── DomainProvisioner.php           # পিএইচপি সিএলআই ও ব্যাকএন্ড ওয়ার্কার প্রোভিশনিং ইঞ্জিন
│   ├── fix_vhosts_and_dns.sh           # vHost ও DNS ফিক্স এবং ডক রুট রিপেয়ার স্ক্রিপ্ট
│   ├── vps_network_inspector.sh        # ভিপিএস নেটওয়ার্ক, পাবলিক আইপি, গেটওয়ে ও ডিএনএস ডায়াগনস্টিক স্ক্রিপ্ট
│   └── apply_nameservers.sh            # নেমসার্ভার ও Bind9 জোন কনফিগারেশন স্ক্রিপ্ট
│
├── src/                                # মূল ফ্রন্টএন্ড ও ব্যাকএন্ড সোর্স কোড (TypeScript / React)
│   ├── App.tsx                         # মেইন React পোর্টাল ও ট্যাব রাউটার
│   ├── types.ts                        # সম্পূর্ণ টাইপ ডেফিনিশন (ServiceItem, DNS, Database, FileManager ইত্যাদি)
│   │
│   ├── server/                         # ব্যাকএন্ড সার্ভার ইঞ্জিন
│   │   ├── apiPlugin.ts                # ★ প্রধান ব্যাকএন্ড ইঞ্জিন (৬০০০+ লাইন): ফাইল ম্যানেজার, ডোমেইন, ডিএনএস,
│   │   │                               #   ইমেইল, এফটিপি, ক্রন জব, সার্ভার রিসোর্স ও ডায়াগনস্টিক API এন্ডপয়েন্টসমূহ
│   │   └── mariadbService.ts           # ★ মারিয়াডিবি ইঞ্জিন: ডাটাবেজ পুলিং, ইউজার ক্রিয়েশন, প্রিভিলেজ ও phpMyAdmin SSO
│   │
│   └── components/                     # React UI কম্পোনেন্টসমূহ
│       ├── FileManagerView.tsx         # ফুল-ফিচার্ড ফাইল ম্যানেজার (ট্রি ভিউ, স্ট্রিমিং আপলোড, কোড এডিটর, জিপ/আনজিপ)
│       ├── MyServicesView.tsx          # সার্ভিস ম্যানেজমেন্ট, ডিএনএস স্ট্যাটাস ও লাইভ SSL ভেরিফিকেশন প্যানেল
│       ├── CPanelDomainsView.tsx       # ডোমেইন সুইট (Domains, Subdomains, Aliases, Redirects, Zone Editor, DDNS)
│       ├── CPanelDatabasesView.tsx     # ডাটাবেজ ক্রিয়েশন, ইউজার ম্যানেজমেন্ট ও উইজার্ড ভিউ
│       ├── GeneralSettingsView.tsx     # সার্ভার আইপি, নেমসার্ভার ও ফেভিকন সেটিংস
│       └── Header.tsx / Sidebar.tsx    # ন্যাভিগেশন বার ও সাইডবার
│
├── brain_artifacts/                    # ★ কনভারসেশনের সমস্ত ডকুমেন্টেশন, স্ক্র্যাচ স্ক্রিপ্ট ও স্ক্রিনশট
│   ├── docs/                           # implementation_plan.md ও walkthrough.md আর্কিটেকচার ডক
│   ├── scratch_tools/                  # টেস্টিং, ডায়াগনস্টিক ও ভেরিফিকেশন স্ক্রিপ্টসমূহ (৩৮টি ফাইল)
│   └── user_screenshots/               # সমস্ত ইউজার-আপলোডেড স্ক্রিনশট ও এরর প্রমাণপত্র (৫৪টি ফাইল)
│
└── server_storage/                     # লোকাল ফাইলসিস্টেম ডাটা স্টোরেজ ও রেজিস্ট্রি
    ├── services.json                   # অ্যাক্টিভ হোস্টিং সার্ভিস ও ডোমেইনের তালিকা
    ├── settings.json                   # গ্লোবাল সার্ভার আইপি ও নেমসার্ভার ইনফো
    └── domains/                        # ডোমেইন ভিত্তিক সিমুলেটেড/লোকাল ফাইল রুট
        ├── hoster1280.shop/            # hoster1280.shop এর ডাটা ও ডিএনএস জোন
        ├── turkyhub.com/               # turkyhub.com এর ডাটা ও ডিএনএস জোন
        └── ...
```

---

## 🚀 ৪. যেকোনো পিসিতে লোকালহোস্টে কীভাবে চালাবেন (Localhost Setup)

যেকোনো নতুন পিসিতে এই ফোল্ডার থেকে প্রজেক্ট চালু করতে:

1. **প্রয়োজনীয় সফটওয়্যার:** Node.js (v18 বা v20+), Git
2. **কমান্ড চালান:**
```bash
cd "F:\users\Pictures\Downloads\hosting"
npm install
npm run build
npm run dev
```
3. ব্রাউজারে খুলুন: `http://localhost:5173` (বা টার্মিনালে প্রদর্শিত পোর্ট)।

---

## 🌐 ৫. উবুন্টু VPS-এ কীভাবে ডিপ্লয় ও আপডেট করবেন (Live VPS Deployment)

ভিপিএস-এ যেকোনো সময় পরিবর্তন আপডেট করতে নিচের ১-ক্লিক কমান্ডটি রান করুন:

```bash
sudo chown -R ubuntu:ubuntu ~/cpanel-1 && cd ~/cpanel-1 && git fetch origin main && git reset --hard origin/main && npm run build && sudo bash scripts/cpanel_full_system_sync.sh
```

### এই কমান্ডটি স্বয়ংক্রিয়ভাবে যা করবে:
1. গিটহাব থেকে সর্বশেষ কোড টেনে আনবে।
2. নতুন বিল্ড (`npm run build`) তৈরি করবে।
3. সমস্ত ডোমেইনের ক্যানোনিকাল পাথ `/var/www/vhosts/{domain}/public_html` নিশ্চিত করবে।
4. Nginx vHost, Bind9 DNS ও PM2 রিলোড করে ওয়েবসাইট ও সিপ্যানেল লাইভ রাখবে।

---

## 🛡️ ৬. ভবিষ্যৎ ডেভেলপার / AntiGravity-এর জন্য গাইডলাইন
- **UI থিম প্রিজারভেশন:** ক্লায়েন্টের নির্দেশ অনুযায়ী `cpanel.html` এবং ফ্রন্টএন্ড ডিজাইনের থিম/কালার প্যালেটে হাত দেওয়া যাবে না।
- **পাথ রেজোলিউশন:** ফাইল সংক্রান্ত যেকোনো কাজ অবশ্যই `getDomainRoot(domain)` ফাংশনের মাধ্যমে `/var/www/vhosts/{domain}` পাথে হ্যান্ডেল করতে হবে।
- **ডাটাবেজ এক্সেস:** `mariadbService.ts` ব্যবহার করে টেন্যান্টের নিজস্ব প্রিফিক্স অনুযায়ী ডাটাবেজ পরিচালনা করতে হবে।

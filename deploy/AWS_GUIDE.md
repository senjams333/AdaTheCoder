# Ada The Coder on AWS: step by step

Three AWS machines:

- **The server** (Ubuntu, always on): the website, the admin, the API and the database. Families' apps talk to it.
- **A Windows machine** (only while you build): makes the `.exe` installer. Stop it afterwards so it costs nothing.
- **A Mac** (only while you build, at least 24 hours): makes the `.dmg` installer for Mac computers.

Keep `AdaTheCoder-APP-vNN.zip` private: it contains `api/.env` with your keys.

---

## Part A. The server

### A1. Launch it (AWS console)

1. Sign in at console.aws.amazon.com and pick a region near your families (for India: **Asia Pacific (Mumbai)**).
2. **EC2 → Instances → Launch instances**:
   - Name: `ada-server`
   - Image: **Ubuntu Server 24.04 LTS**
   - Instance type: **t3.small** (2 GB) works; **t3.medium** (4 GB) is faster
   - Key pair: **Create new key pair** → name `ada-key`, type RSA, format `.pem` → it downloads `ada-key.pem`
   - Network settings → **Allow SSH**, **Allow HTTPS**, **Allow HTTP** (all three ticked)
   - Storage: **30 GB** (lesson videos need room)
3. **Launch instance**.
4. **EC2 → Elastic IPs → Allocate Elastic IP address → Allocate**, then **Actions → Associate** it with
   `ada-server`. This address never changes; it's your server's address (for example `13.234.10.20`).

### A2. Copy the project to it (from your Ubuntu computer)

```
chmod 400 ~/Downloads/ada-key.pem
scp -i ~/Downloads/ada-key.pem ~/Downloads/AdaTheCoder-APP-v74.zip ubuntu@YOUR-ELASTIC-IP:~
ssh -i ~/Downloads/ada-key.pem ubuntu@YOUR-ELASTIC-IP
```

(Use your newest zip name and your Elastic IP. Type `yes` the first time.)

### A3. Set it up (on the server, after `ssh`)

```
sudo apt-get update && sudo apt-get install -y unzip
unzip -q AdaTheCoder-APP-v74.zip && mv AdaTheCoder Ada && cd Ada
bash deploy/aws_server_setup.sh YOUR-ELASTIC-IP
```

It takes about 10 minutes. At the end it prints the website address and says `API: OK` and `Website: OK`.

### A4. Try it

- Website: `http://YOUR-ELASTIC-IP`
- Admin: `http://YOUR-ELASTIC-IP/admin/login`: the first visit asks you to create the admin account.
- Check the app's address works: `http://YOUR-ELASTIC-IP/api/v3/courses` shows text (JSON).

### A5. Later: your own domain with HTTPS (before real families)

1. At your domain provider, add an **A record**: `www` → your Elastic IP (and `@` → the same).
2. Wait until `ping www.adathecoder.com` shows your Elastic IP, then on the server:
   ```
   cd ~/Ada && bash deploy/aws_server_setup.sh www.adathecoder.com you@example.com
   ```
   That adds a free HTTPS certificate.
3. Razorpay: use **Live keys** in `api/.env` (Live keys only work on the registered domain) and set the
   webhook to `https://www.adathecoder.com/api/pay/razorpay/webhook`. Then `pm2 restart ada-api`.

### Updating the server with a newer version

From your computer: `scp -i ~/Downloads/ada-key.pem ~/Downloads/AdaTheCoder-APP-vNN.zip ubuntu@YOUR-ELASTIC-IP:~`, then on
the server:

```
cd ~ && rm -rf AdaTheCoder && unzip -q AdaTheCoder-APP-vNN.zip && cp Ada/api/.env AdaTheCoder/api/.env && cp -r Ada/api/uploads AdaTheCoder/api/ && rm -rf Ada-old && mv Ada Ada-old && mv AdaTheCoder Ada && cd Ada && bash deploy/aws_server_setup.sh YOUR-ADDRESS
```

---

## Part B. The Windows installer (.exe)

### B1. Launch a Windows machine (AWS console)

1. **EC2 → Launch instances**: Name `ada-build`, Image **Microsoft Windows Server 2022 Base**, type **t3.medium**,
   key pair **ada-key**, storage 50 GB → **Launch**.
2. Wait 5 minutes, select it → **Connect → RDP client → Get password** → upload `ada-key.pem` → **Decrypt**.
   Copy the Public IP, user `Administrator` and the password.
3. On your Ubuntu computer open **Remmina** (install: `sudo apt install remmina`), choose **RDP**, type the
   Public IP, log in as `Administrator` with that password.

### B2. Build (inside the Windows machine)

1. In its browser (Edge), download and install:
   - **Python 3.11** from python.org (tick **Add python.exe to PATH**)
   - **Inno Setup 6** from jrsoftware.org
2. Get the app onto it: in Remmina's side menu, share a folder, or download `AdaTheCoder-DesktopApp-1.2.0.zip`
   from wherever you keep it. Unzip it to `C:\AdaBuild`.
3. Open **Command Prompt**:
   ```
   cd C:\AdaBuild\AdaTheCoder-DesktopApp\desktop_app
   build_windows.bat http://YOUR-ELASTIC-IP
   ```
   (Later, with your domain: `build_windows.bat https://www.adathecoder.com`.)
4. After 5 to 10 minutes: `C:\AdaBuild\AdaTheCoder-DesktopApp\desktop_app\dist\AdaTheCoder-1.2.0-Windows-Setup.exe`.

### B3. Put it on the website

Still inside the Windows machine, open `http://YOUR-ELASTIC-IP/admin/login` → **App versions** → upload the
Setup `.exe` as version **1.2.0** and make it the current download. Parents now download it from their account page.

### B4. Stop the Windows machine

**EC2 → Instances → ada-build → Instance state → Stop** (or **Terminate** if you won't build again soon).
A stopped machine costs only for its disk.

---

## Part C. The Mac installer (.dmg)

A Mac installer can only be built on a Mac. AWS rents real Macs ("EC2 Mac"), always for **at least 24 hours**
(about US$1 an hour, so roughly US$25 for one build day). Build both installers on the same day if you can.
(iPhones and iPads can't run this app: it is for Mac and Windows computers.)

### C1. Get a Mac on AWS (console)

1. **EC2 → Dedicated Hosts → Allocate Dedicated Host**: Name `ada-mac`, Instance family **mac1**,
   Instance type **mac1.metal** (Intel: the app's video player is most reliable there and it also runs on new
   Apple-chip Macs), any Availability Zone → **Allocate**. (If your region has no mac1, try another region or
   **mac2.metal**.)
2. **EC2 → Launch instances**: Name `ada-mac-build`, Image **macOS Sonoma** (Quick Start → macOS), type
   **mac1.metal**, key pair **ada-key**, storage 100 GB. Under **Advanced details → Tenancy: Dedicated host**,
   pick `ada-mac` → **Launch**. It takes 10 to 20 minutes to start.

### C2. Build (from your Ubuntu computer, everything over SSH)

```
scp -i ~/Downloads/ada-key.pem ~/Downloads/AdaTheCoder-DesktopApp-1.2.0.zip ec2-user@MAC-PUBLIC-IP:~
ssh -i ~/Downloads/ada-key.pem ec2-user@MAC-PUBLIC-IP
```

Then on the Mac:

```
curl -sO https://www.python.org/ftp/python/3.11.9/python-3.11.9-macos11.pkg
sudo installer -pkg python-3.11.9-macos11.pkg -target /
unzip -q AdaTheCoder-DesktopApp-1.2.0.zip && cd AdaTheCoder-DesktopApp/desktop_app
bash build_mac.sh http://YOUR-ELASTIC-IP
exit
```

Back on your Ubuntu computer, fetch the installer:

```
scp -i ~/Downloads/ada-key.pem "ec2-user@MAC-PUBLIC-IP:~/AdaTheCoder-DesktopApp/desktop_app/dist/AdaTheCoder-1.2.0-Mac.dmg" ~/Downloads/
```

### C3. Put it on the website, then stop paying

1. `http://YOUR-ELASTIC-IP/admin/login` → **App versions** → upload `AdaTheCoder-1.2.0-Mac.dmg` as version **1.2.0**
   (Mac) and make it the current Mac download.
2. **Terminate** the `ada-mac-build` instance, then **Dedicated Hosts → ada-mac → Actions → Release host**
   (allowed once 24 hours have passed). Until it is released, it keeps costing money.

### Good to know about Mac

Without an Apple Developer ID (US$99 a year) the Mac says the app "can't be checked for malicious software".
Testers: right-click the app → **Open** → **Open**. For real families, sign and notarize it with a Developer ID.

## What updates by itself

Themes, lessons, videos, prices, the break reminder and the website text you change in the admin reach every
installed app within about a minute. Build a new `.exe` only when the app's own code changes: raise `APP_VERSION`
in `desktop_app/ada_coder/config.py`, build, upload in **App versions**; installed apps tell families.

## Costs (roughly)

The server (t3.small) is about US$15–20 a month plus a little for disk and data. The Windows build machine
costs about US$0.10 an hour only while running.

---

## Forgot the admin password

1. First try **https://www.adathecoder.com/forgot-password** with the admin email (a reset email arrives).
2. Or set a new one on the server (replace `MyNewPass2026`; avoid the characters ' " ! $):

```
cd ~/Ada/api && node -e "console.log(require('bcryptjs').hashSync('MyNewPass2026', 12))" > /tmp/h.txt
U=$(grep -E "^DB_USER=" .env | cut -d= -f2-); P=$(grep -E "^DB_PASSWORD=" .env | cut -d= -f2-); D=$(grep -E "^DB_NAME=" .env | cut -d= -f2-); mysql -h 127.0.0.1 -u "$U" -p"$P" "$D" -e "UPDATE users SET password_hash='$(cat /tmp/h.txt)' WHERE role='admin'; SELECT email, ROW_COUNT() AS changed FROM users WHERE role='admin';"; rm -f /tmp/h.txt; pm2 restart ada-api
```

"Too many tries" on the log-in page clears with `pm2 restart ada-api`.

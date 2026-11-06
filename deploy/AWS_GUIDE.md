# Ada The Coder on AWS: step by step

Two AWS machines:

- **The server** (Ubuntu, always on): the website, the admin, the API and the database. Families' apps talk to it.
- **A Windows machine** (only while you build): makes the `.exe` installer. Stop it afterwards so it costs nothing.

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

## What updates by itself

Themes, lessons, videos, prices, the break reminder and the website text you change in the admin reach every
installed app within about a minute. Build a new `.exe` only when the app's own code changes: raise `APP_VERSION`
in `desktop_app/ada_coder/config.py`, build, upload in **App versions**; installed apps tell families.

## Costs (roughly)

The server (t3.small) is about US$15–20 a month plus a little for disk and data. The Windows build machine
costs about US$0.10 an hour only while running.

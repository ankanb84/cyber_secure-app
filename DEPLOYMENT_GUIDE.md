# Deployment Guide for Secure Chat

To make your app accessible to everyone on the internet, we will deploy it to **Render.com** (which is free and easy).

## Prerequisites

1.  **GitHub Account**: You need to upload your code to GitHub.
2.  **Render Account**: Sign up at [render.com](https://render.com).
3.  **MongoDB Atlas Account**: Sign up at [mongodb.com/atlas](https://www.mongodb.com/cloud/atlas).

---

## Step 1: Set up Cloud Database (MongoDB Atlas)

Since your local database won't work on the cloud, we need a cloud database.

1.  Log in to **MongoDB Atlas**.
2.  Create a **New Cluster** (select the Free Shared tier).
3.  Go to **Database Access** -> Create a new user (e.g., `admin`) and password. **Remember this password!**
4.  Go to **Network Access** -> Add IP Address -> Select **"Allow Access from Anywhere"** (0.0.0.0/0).
5.  Go to **Database** -> Click **Connect** -> Choose **"Drivers"**.
6.  **Copy the Connection String**. It looks like:
    `mongodb+srv://admin:<password>@cluster0.mongodb.net/?retryWrites=true&w=majority`
7.  Replace `<password>` with your actual password. **Save this string.**

---

## Step 2: Upload Code to GitHub

1.  Create a **New Repository** on GitHub (e.g., `secure-chat`).
2.  Open your terminal in `d:\cyber_chat` and run:
    ```bash
    git init
    git add .
    git commit -m "Initial commit"
    git branch -M main
    git remote add origin https://github.com/YOUR_USERNAME/secure-chat.git
    git push -u origin main
    ```

---

## Step 3: Deploy to Render

1.  Log in to **Render Dashboard**.
2.  Click **New +** -> **Web Service**.
3.  Connect your **GitHub** account and select the `secure-chat` repository.
4.  **Configure the Service**:
    *   **Name**: `secure-chat` (or any unique name)
    *   **Region**: Closest to you (e.g., Singapore or Frankfurt)
    *   **Branch**: `main`
    *   **Root Directory**: `.` (Leave empty)
    *   **Runtime**: `Node`
    *   **Build Command**: `npm run build`
    *   **Start Command**: `npm start`
    *   **Plan**: Free

5.  **Environment Variables** (Scroll down to "Advanced"):
    Add the following variables:
    *   `NODE_ENV` = `production`
    *   `MONGODB_URI` = *(Paste your MongoDB Atlas connection string here)*
    *   `JWT_SECRET` = *(Type a random long secret code, e.g., `mysecretkey123`)*

6.  Click **Create Web Service**.

---

## Step 4: Done!

Render will take a few minutes to build and deploy your app.
Once finished, it will give you a URL like:
**`https://secure-chat.onrender.com`**

Share this link with your friends! They can open it on any mobile or PC browser.

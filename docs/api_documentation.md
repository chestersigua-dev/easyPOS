# API Documentation

The EasyPOS API is built using Fastify and runs under the `/api/v1` prefix. All requests and responses are in JSON format.

---

## 1. Authentication (`/api/v1/auth`)

### POST `/login`
Authenticate a user.
- **Payload:**
  ```json
  {
    "email": "superadmin@easypos.com",
    "password": "admin123"
  }
  ```
- **Response:**
  ```json
  {
    "accessToken": "eyJhbGciOi...",
    "user": {
      "id": "uuid-string",
      "email": "superadmin@easypos.com",
      "firstName": "Alex",
      "lastName": "Super",
      "role": "SUPERADMIN",
      "mfaEnabled": false
    }
  }
  ```
- **Notes:** Returns access token in body and sets refresh token rotation inside HttpOnly cookie. If user has MFA enabled, returns `{ "mfaRequired": true, "userId": "uuid-string" }`.

### POST `/login/mfa`
Complete MFA authentication challenge.
- **Payload:**
  ```json
  {
    "userId": "uuid-string",
    "token": "123456"
  }
  ```

### POST `/mfa/setup`
Initialize authenticator TOTP setup.
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
  ```json
  {
    "secret": "JBSWY3DPEHPK3PXP",
    "qrDataUrl": "data:image/png;base64,..."
  }
  ```

---

## 2. Products (`/api/v1/products`)

### GET `/`
Retrieve products inventory list.
- **Query Params:**
  - `search` (filter name, sku, brand, category)
  - `lowStock` (`true` to filter low stock items)

### POST `/`
Create product.
- **Payload:** Product details matches `ProductSchema`.

### POST `/adjust`
Apply approved stock adjustments.
- **Payload:**
  ```json
  {
    "productId": "uuid-string",
    "type": "IN",
    "quantity": 10,
    "reason": "Supplier shipment intake"
  }
  ```

---

## 3. Sales (`/api/v1/sales`)

### POST `/`
Process sale register transaction.
- **Payload:**
  ```json
  {
    "customerId": "CUST-2026-0001",
    "subtotal": 34500,
    "tax": 4140,
    "discount": 0,
    "total": 38640,
    "paymentType": "CASH",
    "items": [
      {
        "productId": "product-uuid",
        "quantity": 1,
        "price": 34500
      }
    ],
    "payments": [
      {
        "amount": 38640,
        "type": "CASH"
      }
    ]
  }
  ```

### GET `/:id/receipt`
Retrieve PDF printable invoice receipt.
- **Response:** PDF binary download.

---

## 4. Repairs (`/api/v1/repairs`)

### POST `/`
Open a repair hardware ticket.
- **Payload:** Matches `RepairSchema`, includes optional `customerSignature` and `technicianSignature` as base64 strings.

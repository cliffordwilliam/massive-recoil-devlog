CREATE TABLE users (
  id                  SERIAL PRIMARY KEY,
  email               VARCHAR(255) NOT NULL UNIQUE,
  encrypted_password  VARCHAR(255) NOT NULL,
  username            VARCHAR(100) NOT NULL,
  created_at          TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX index_users_on_email ON users (email);

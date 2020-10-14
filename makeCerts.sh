#!/bin/bash

rm -rf certs
mkdir certs

# correct ca
openssl genrsa -out certs/ca.privkey.pem 2048

openssl req \
  -x509 \
  -new \
  -nodes \
  -key \
  certs/ca.privkey.pem \
  -days \
  1024 -out certs/ca.cert.pem -subj "/C=US/ST=Utah/L=Provo/O=ACME Signing Authority Inc/CN=example.com"

# wrong ca
openssl genrsa -out certs/ca.wrong.privkey.pem 2048

openssl req \
  -x509 \
  -new \
  -nodes \
  -key \
  certs/ca.wrong.privkey.pem \
  -days \
  1024 -out certs/ca.wrong.cert.pem -subj "/C=US/ST=Utah/L=Provo/O=ACME Signing Authority Inc/CN=example.com"

# node1
openssl genrsa -out certs/localhost.1.privkey.pem 2048

openssl req -new \
 -key certs/localhost.1.privkey.pem \
 -out certs/localhost.1.csr.pem \
 -subj "/C=US/ST=Utah/L=Provo/O=ACME Tech Inc/CN=localhost"

openssl x509 \
 -req -in certs/localhost.1.csr.pem \
 -CA certs/ca.cert.pem \
 -CAkey certs/ca.privkey.pem \
 -CAcreateserial \
 -out certs/localhost.1.cert.pem \
 -days 500

# node2
openssl genrsa -out certs/localhost.2.privkey.pem 2048

openssl req -new \
 -key certs/localhost.2.privkey.pem \
 -out certs/localhost.2.csr.pem \
 -subj "/C=US/ST=Utah/L=Provo/O=ACME Tech Inc/CN=localhost"

openssl x509 \
 -req -in certs/localhost.2.csr.pem \
 -CA certs/ca.cert.pem \
 -CAkey certs/ca.privkey.pem \
 -CAcreateserial \
 -out certs/localhost.2.cert.pem \
 -days 500

# wrong
openssl genrsa -out certs/localhost.wrong.privkey.pem 2048

openssl req -new \
 -key certs/localhost.wrong.privkey.pem \
 -out certs/localhost.wrong.csr.pem \
 -subj "/C=US/ST=Utah/L=Provo/O=ACME Tech Inc/CN=localhost"

openssl x509 \
 -req -in certs/localhost.wrong.csr.pem \
 -CA certs/ca.wrong.cert.pem \
 -CAkey certs/ca.wrong.privkey.pem \
 -CAcreateserial \
 -out certs/localhost.wrong.cert.pem \
 -days 500

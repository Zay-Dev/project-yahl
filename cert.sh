#!/bin/bash
openssl genpkey -algorithm RSA -out private-jwt.pem -pkeyopt rsa_keygen_bits:2048
openssl rsa -in private-jwt.pem -pubout -out public-jwt.pem

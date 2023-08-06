// Use this code snippet in your app.
// If you need more information about configurations or implementing the sample code, visit the AWS docs:
// https://docs.aws.amazon.com/sdk-for-javascript/v3/developer-guide/getting-started.html

const secret_name = "secret3";

const client = new SecretsManagerClient({
  region: "us-west-1c",
});

let response;

try {
  response = await client.send(
    new GetSecretValueCommand({
      SecretId: secret_name,
      VersionStage: "AWSCURRENT", // VersionStage defaults to AWSCURRENT if unspecified
    })
  );
} catch (error) {
  // For a list of exceptions thrown, see
  // https://docs.aws.amazon.com/secretsmanager/latest/apireference/API_GetSecretValue.html
  throw error;
}

const secret = response.SecretString;

import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import {google} from "googleapis";
import {body, validationResult} from "express-validator";
import axios from "axios";
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

const app = express();
app.use(bodyParser.json());
app.use(cors());

client
  .send(
    new GetSecretValueCommand({
      SecretId: secret_name,
      VersionStage: "AWSCURRENT",
    })
  )
  .then((response) => {
    const secret = response.SecretString;
    const {private_key, client_email, WHOISXML_API_KEY} = JSON.parse(secret);
    console.log(
      "🚀 ~ file: index.js:53 ~ .then ~ WHOISXML_API_KEY:",
      WHOISXML_API_KEY
    );

    const googleAuthClient = new google.auth.JWT(
      client_email,
      null,
      private_key,
      ["https://www.googleapis.com/auth/spreadsheets"]
    );

    googleAuthClient.authorize((err, tokens) => {
      if (err) {
        console.log(err);
        return;
      }
      console.log("Connected!");
    });

    app.post("/submit", body("companyEmail").isEmail(), async (req, res) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({errors: errors.array()});
      }

      const {businessName, country, phoneNumber, companyEmail} = req.body;
      try {
        const emailApiUrl = "https://emailverification.whoisxmlapi.com/api/v1";
        const emailApiResponse = await axios.get(emailApiUrl, {
          params: {
            apiKey: WHOISXML_API_KEY,
            emailAddress: companyEmail,
          },
        });

        if (
          emailApiResponse.data.formatCheck === "false" ||
          emailApiResponse.data.dnsCheck === "false" ||
          emailApiResponse.data.smtpCheck === "false"
        ) {
          return res.status(400).json({errors: ["Email is not valid"]});
        }
      } catch (err) {
        console.error(err);
        return res
          .status(500)
          .json({errors: ["Error checking email validity"]});
      }

      const sheets = google.sheets({version: "v4", auth: googleAuthClient});

      try {
        await sheets.spreadsheets.values.append({
          spreadsheetId: "1NxAWXGByOE3mL7hkrc9-Qng0PJ7mmhLuOVN52ay4KP4",
          range: "Sheet1",
          valueInputOption: "RAW",
          resource: {
            values: [[businessName, country, phoneNumber, companyEmail]],
          },
        });
        res.json({success: true, message: "Data submitted successfully"});
      } catch (err) {
        console.error(err);
        return res.status(500).json({errors: ["An error occurred"]});
      }
    });
  });

app.listen(5001, () => console.log("Server started on port 5001"));

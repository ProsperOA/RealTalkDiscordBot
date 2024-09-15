import {
  statements,
  statementWitnesses,
  updoots,
  reminders,
} from "../db/models";

export default {
  ...statements,
  ...statementWitnesses,
  ...updoots,
  ...reminders,
};

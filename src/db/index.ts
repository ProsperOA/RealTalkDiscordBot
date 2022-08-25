import { statements, statementWitnesses, updoots } from "../db/models";

export default {
  ...statements,
  ...statementWitnesses,
  ...updoots,
};

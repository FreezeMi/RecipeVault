import bcrypt from 'bcrypt';
import readline from 'node:readline';
import { Writable } from 'node:stream';
import { prisma } from '../db';
import { PASSWORD_RULES } from '../validation';

// Output stream that can be muted so typed passwords are not echoed to the terminal.
let muted = false;
const output = new Writable({
  write(chunk, encoding, callback) {
    if (!muted) process.stdout.write(chunk, encoding);
    callback();
  },
});

const rl = readline.createInterface({ input: process.stdin, output, terminal: process.stdin.isTTY ?? false });
// The async iterator buffers lines, so piped input works too (lines may arrive before they're asked for).
const lines = rl[Symbol.asyncIterator]();

const readLine = async (): Promise<string> => {
  const { value, done } = await lines.next();
  return done ? '' : String(value);
};

const ask = async (query: string): Promise<string> => {
  process.stdout.write(query);
  return (await readLine()).trim();
};

const askHidden = async (query: string): Promise<string> => {
  process.stdout.write(query);
  muted = true;
  try {
    return await readLine();
  } finally {
    muted = false;
    process.stdout.write('\n');
  }
};

const fail = (message: string): never => {
  console.error(message);
  process.exit(1);
};

const promptNewPassword = async (): Promise<string> => {
  const password = await askHidden(`Password (min ${PASSWORD_RULES.minLength} chars): `);
  if (password.length < PASSWORD_RULES.minLength) fail(`Password must be at least ${PASSWORD_RULES.minLength} characters.`);
  if (Buffer.byteLength(password) > PASSWORD_RULES.maxBytes) fail(`Password must be at most ${PASSWORD_RULES.maxBytes} bytes.`);
  const confirmation = await askHidden('Confirm password: ');
  if (password !== confirmation) fail('Passwords do not match.');
  return password;
};

async function main() {
  console.log('--- Recipe Vault admin account ---');

  // Only one account is supported. If it exists, offer a password reset instead.
  const existingUser = await prisma.user.findFirst();
  if (existingUser) {
    console.log(`An account already exists for ${existingUser.email}.`);
    const answer = await ask('Reset its password? (y/N): ');
    if (answer.toLowerCase() !== 'y') {
      console.log('No changes made.');
      return;
    }
    const passwordHash = await bcrypt.hash(await promptNewPassword(), 12);
    await prisma.$transaction([
      prisma.user.update({ where: { id: existingUser.id }, data: { passwordHash } }),
      prisma.session.deleteMany({ where: { userId: existingUser.id } }),
    ]);
    console.log('Password reset. All existing sessions were signed out.');
    return;
  }

  const email = (await ask('Email: ')).toLowerCase();
  const at = email.indexOf('@');
  if (at < 1 || at === email.length - 1 || /\s/.test(email)) fail('Invalid email address.');

  const passwordHash = await bcrypt.hash(await promptNewPassword(), 12);
  await prisma.user.create({ data: { email, passwordHash } });
  console.log('Admin account created successfully!');
}

main()
  .catch(error => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });

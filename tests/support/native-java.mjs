// JVM checks use the real org.json parser, not a hand-written JSON stub.
// The Android runtime already supplies org.json. For desktop tests, point
// TOUCHLINE_TEST_JSON_JAR at an existing org.json JAR or use a Gradle cache.
// This helper never downloads packages or opens a network connection.
import { existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

export function jsonJar() {
  if (process.env.TOUCHLINE_TEST_JSON_JAR) {
    if (!existsSync(process.env.TOUCHLINE_TEST_JSON_JAR)) throw new Error('TOUCHLINE_TEST_JSON_JAR findes ikke.');
    return process.env.TOUCHLINE_TEST_JSON_JAR;
  }
  const caches = [process.env.GRADLE_USER_HOME, join(homedir(), '.gradle'), '.gradle-user', '/workspace/android-tools/gradle-cache'].filter(Boolean);
  for (const cache of caches) {
    const root = join(cache, 'caches/modules-2/files-2.1/org.json/json');
    if (!existsSync(root)) continue;
    const jars = readdirSync(root, { recursive: true }).filter((file) => /(?:^|[/\\])json-[^/\\]+\.jar$/.test(file)).sort();
    if (jars.length) return join(root, jars[jars.length - 1]);
  }
  throw new Error('JVM-testen kræver en eksisterende org.json JAR. Angiv TOUCHLINE_TEST_JSON_JAR; ingen pakker downloades automatisk.');
}

export const nativeClasspath = (...entries) => entries.join(delimiter);

export function javaCommand(name) {
  const workspaceJdk = '/workspace/android-tools/jdk-21.0.13+9';
  const javaHome = process.env.JAVA_HOME || (existsSync(join(workspaceJdk, 'bin/javac')) ? workspaceJdk : null);
  return javaHome ? join(javaHome, 'bin', name) : name;
}

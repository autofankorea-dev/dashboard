import assert from "node:assert/strict";
import { test } from "vitest";
import { resolveProfileAvatarUrl } from "./profile-avatar";

test("keeps a Google https avatar", () => {
  const url = "https://lh3.googleusercontent.com/a/example=s96-c";
  assert.equal(resolveProfileAvatarUrl({ avatar_url: url, picture: url }), url);
});

test("upgrades a Kakao http avatar to https", () => {
  assert.equal(
    resolveProfileAvatarUrl({
      avatar_url: "http://k.kakaocdn.net/dn/example/img_640x640.jpg",
    }),
    "https://k.kakaocdn.net/dn/example/img_640x640.jpg",
  );
});

test("uses picture when avatar_url is empty", () => {
  assert.equal(
    resolveProfileAvatarUrl({
      avatar_url: "  ",
      picture: "https://lh3.googleusercontent.com/a/picture",
    }),
    "https://lh3.googleusercontent.com/a/picture",
  );
});

test("drops email accounts and other hosts", () => {
  assert.equal(resolveProfileAvatarUrl({ email_verified: true }), null);
  assert.equal(resolveProfileAvatarUrl(null), null);
  assert.equal(
    resolveProfileAvatarUrl({ avatar_url: "https://example.com/a.png" }),
    null,
  );
  assert.equal(
    resolveProfileAvatarUrl({ avatar_url: "javascript:alert(1)" }),
    null,
  );
});

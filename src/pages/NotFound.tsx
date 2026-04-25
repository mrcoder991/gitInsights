import { Button, Flex, Group, Text, Title } from '@mantine/core';
import { Link } from 'react-router-dom';

// In-app 404 — hero code in mono, tagline, dual CTAs.
export function NotFoundPage(): JSX.Element {
  return (
    <Flex
      direction="column"
      align="center"
      justify="center"
      gap="xl"
      py="xl"
      px="md"
      style={{ minHeight: 'min(72vh, calc(100dvh - 6.5rem))' }}
    >
      <Title
        order={1}
        fz="clamp(3.75rem, 12vw, 6.75rem)"
        fw={700}
        lh={1}
        ff="monospace"
        c="var(--gi-fg-default)"
        ta="center"
      >
        404
      </Title>

      <Text size="lg" c="dimmed" ta="center" maw={520}>
        this route doesn&apos;t exist. neither does the work you didn&apos;t do today. that&apos;s
        fine.
      </Text>

      <Group gap="md" wrap="wrap" justify="center">
        <Button component={Link} to="/dashboard" size="md" color="primerBlue" replace>
          back to dashboard
        </Button>
        <Button component={Link} to="/" size="md" variant="default" replace>
          home
        </Button>
      </Group>
    </Flex>
  );
}

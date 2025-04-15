'use client';

import React from 'react';
import { Card, CardHeader, CardBody, Text, VStack, Icon } from '@chakra-ui/react';
import { InformationCircleIcon, ExclamationTriangleIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface FeaturePanelProps {
  title: string;
  description: string;
  icon: 'info' | 'warning' | 'success';
}

export function FeaturePanel({ title, description, icon }: FeaturePanelProps) {
  const getIcon = () => {
    switch (icon) {
      case 'warning':
        return ExclamationTriangleIcon;
      case 'success':
        return CheckCircleIcon;
      default:
        return InformationCircleIcon;
    }
  };

  const getIconColor = () => {
    switch (icon) {
      case 'warning':
        return 'orange.500';
      case 'success':
        return 'green.500';
      default:
        return 'blue.500';
    }
  };

  return (
    <Card variant="outline">
      <CardHeader>
        <VStack spacing={2} align="stretch">
          <Text fontSize="lg" fontWeight="bold" display="flex" alignItems="center">
            <Icon as={getIcon()} boxSize={5} color={getIconColor()} mr={2} />
            {title}
          </Text>
          <Text color="gray.600" fontSize="sm">
            {description}
          </Text>
        </VStack>
      </CardHeader>
    </Card>
  );
}

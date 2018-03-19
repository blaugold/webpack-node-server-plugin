#!/usr/bin/env bash

cd $(dirname ${BASH_SOURCE})

cd project_run

# Install build from ../release
yarn

./node_modules/.bin/webpack

test_run_success=$([ $? -eq 42 ])

exit ${test_run_success}
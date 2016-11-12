#!/usr/bin/env bash

cd $(dirname ${BASH_SOURCE})

cd project_run
../../node_modules/.bin/webpack

test_run_success=$([ $? -eq 42 ])

exit $test_run_success